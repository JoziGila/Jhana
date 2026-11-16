"""Unit tests for the EEG feature code and the statistics pipeline.  Run: python3 -m unittest eeg/test_features.py"""

import os
import subprocess
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from features import aperiodic_slope, auc, band_power, bandpass, epoch_features, lda_fit, lz76, lz_complexity, psd  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


class TestLZ(unittest.TestCase):
    def test_known_parsing(self):
        # Kaspar & Schuster's worked example: 0|001|10|100|1000|101 -> 6 phrases
        self.assertEqual(lz76("0001101001000101"), 6)
        self.assertEqual(lz76("0" * 64), 2)
        self.assertEqual(lz76("01" * 32), 3)

    def test_ordering(self):
        rng = np.random.default_rng(1)
        white = lz_complexity(rng.normal(size=1024))
        sine = lz_complexity(np.sin(np.arange(1024) / 20))
        smooth = lz_complexity(np.convolve(rng.normal(size=1100), np.ones(40) / 40, mode="valid")[:1024])
        self.assertGreater(white, 0.9)
        self.assertLess(sine, 0.2)
        self.assertTrue(sine < smooth < white)


class TestSpectral(unittest.TestCase):
    def test_band_power_finds_a_10hz_rhythm(self):
        fs = 256
        t = np.arange(fs * 8) / fs
        x = np.sin(2 * np.pi * 10 * t)[None, :]
        f, p = psd(x, fs)
        self.assertGreater(band_power(f, p, 8, 13)[0], 20 * band_power(f, p, 13, 30)[0])

    def test_slope_recovers_1_over_f_exponent(self):
        rng = np.random.default_rng(2)
        fs, n = 256, 256 * 64
        freqs = np.fft.rfftfreq(n, 1 / fs)
        for exponent in (1.0, 2.0):
            spec = (rng.normal(size=freqs.size) + 1j * rng.normal(size=freqs.size))
            spec[1:] /= freqs[1:] ** (exponent / 2)
            spec[0] = 0
            x = np.fft.irfft(spec, n)[None, :]
            f, p = psd(x, fs)
            self.assertAlmostEqual(float(aperiodic_slope(f, p)[0]), -exponent, delta=0.2)

    def test_flatter_spectrum_gives_higher_lz(self):
        """The two 'signatures' are not independent: this is why the report treats them together."""
        rng = np.random.default_rng(3)
        fs, n = 128, 1024
        freqs = np.fft.rfftfreq(n, 1 / fs)
        out = []
        for exponent in (2.0, 1.0, 0.0):
            spec = rng.normal(size=freqs.size) + 1j * rng.normal(size=freqs.size)
            spec[1:] /= freqs[1:] ** (exponent / 2)
            spec[0] = 0
            out.append(lz_complexity(np.fft.irfft(spec, n)))
        self.assertTrue(out[0] < out[1] < out[2])

    def test_epoch_features_shape_and_bandpass(self):
        rng = np.random.default_rng(4)
        x = bandpass(rng.normal(size=(4, 2048)) * 10, 256)
        feats = epoch_features(x, 256)
        for key in ("log_broadband", "lz", "slope", "log_alpha", "log_gamma"):
            self.assertTrue(np.isfinite(feats[key]))


class TestClassifier(unittest.TestCase):
    def test_auc(self):
        self.assertEqual(auc(np.array([0.1, 0.2, 0.8, 0.9]), np.array([0, 0, 1, 1])), 1.0)
        self.assertEqual(auc(np.array([0.9, 0.8, 0.2, 0.1]), np.array([0, 0, 1, 1])), 0.0)
        self.assertAlmostEqual(auc(np.array([1, 1, 1, 1.0]), np.array([0, 1, 0, 1])), 0.5)

    def test_lda_separates_shifted_gaussians(self):
        rng = np.random.default_rng(5)
        X = np.vstack([rng.normal(0, 1, (200, 3)), rng.normal(1, 1, (200, 3))])
        y = np.array([0] * 200 + [1] * 200)
        w, b = lda_fit(X, y)
        self.assertGreater(auc(X @ w + b, y), 0.85)


class TestPipeline(unittest.TestCase):
    def test_simulated_run_is_labelled_and_recovers_the_planted_effect(self):
        r = subprocess.run([sys.executable, os.path.join(HERE, "stats.py"), "--simulated"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("SIMULATED", r.stdout)
        report = open(os.path.join(HERE, "results", "REPORT_simulated.md")).read()
        self.assertIn("SIMULATED", report)
        self.assertIn("Nothing below is a finding", report)
        import json
        s = json.load(open(os.path.join(HERE, "results", "summary_simulated.json")))
        self.assertFalse(s["real"])
        self.assertGreater(s["signatures"]["full:jhana_vs_baseline:lz"]["dz"], 0.8)


if __name__ == "__main__":
    unittest.main()
