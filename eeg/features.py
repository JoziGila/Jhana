"""Signal features used to test the published EEG signatures of jhana.

Pure numpy/scipy functions with no file access, so they can be unit-tested (eeg/test_features.py).

Signatures under test (docs/understanding/03-research.md):
  - lower broadband power in jhana than in control tasks            (Chowdhury et al. 2025, n=1)
  - higher Lempel-Ziv complexity                                    (Chowdhury 2025, n=1; Mago 2025, n=10)
  - flatter aperiodic 1/f slope                                     (Mago et al. 2025, n=10)
"""

from __future__ import annotations

import numpy as np
from scipy import signal

BANDS = {"delta": (1, 4), "theta": (4, 8), "alpha": (8, 13), "beta": (13, 30), "gamma": (30, 45)}


def lz76(binary: str) -> int:
    """Lempel-Ziv (1976) complexity: number of distinct phrases in an exhaustive parsing."""
    i, c, n = 0, 0, len(binary)
    while i < n:
        length = 1
        # extend the phrase while it has already occurred in the text before its last symbol
        while i + length <= n and binary[i : i + length] in binary[0 : i + length - 1]:
            length += 1
        c += 1
        i += length
    return c


def lz_complexity(x: np.ndarray) -> float:
    """Normalised LZ complexity of a 1-D signal binarised around its median.

    Normalised by n / log2(n), so white noise gives about 1 and a constant or slowly varying
    signal gives values near 0.
    """
    x = np.asarray(x, dtype=float)
    n = x.size
    if n < 16:
        return float("nan")
    bits = "".join("1" if v else "0" for v in (x > np.median(x)))
    return lz76(bits) * np.log2(n) / n


def psd(x: np.ndarray, fs: float) -> tuple[np.ndarray, np.ndarray]:
    """Welch power spectral density along the last axis (2-second windows)."""
    nper = int(min(x.shape[-1], 2 * fs))
    return signal.welch(x, fs=fs, nperseg=nper, noverlap=nper // 2, axis=-1)


def band_power(freqs: np.ndarray, pxx: np.ndarray, lo: float, hi: float) -> np.ndarray:
    """Mean spectral density in [lo, hi) Hz along the last axis (a rectangle-rule band power)."""
    mask = (freqs >= lo) & (freqs < hi)
    return pxx[..., mask].mean(axis=-1) * (hi - lo)


def aperiodic_slope(freqs: np.ndarray, pxx: np.ndarray, lo: float = 2, hi: float = 40, skip=(7, 14)) -> np.ndarray:
    """Slope of log10(power) against log10(frequency), skipping the alpha peak.

    More negative = steeper 1/f. "Flatter" in the literature means closer to zero.
    """
    mask = (freqs >= lo) & (freqs <= hi) & ~((freqs >= skip[0]) & (freqs <= skip[1]))
    lf = np.log10(freqs[mask])
    lp = np.log10(np.maximum(pxx[..., mask], 1e-30))
    lf_c = lf - lf.mean()
    return (lp * lf_c).sum(axis=-1) / (lf_c**2).sum()


def bandpass(x: np.ndarray, fs: float, lo: float = 1.0, hi: float = 45.0) -> np.ndarray:
    sos = signal.butter(4, [lo, hi], btype="bandpass", fs=fs, output="sos")
    return signal.sosfiltfilt(sos, x, axis=-1)


def epoch_features(eeg_uv: np.ndarray, fs: float, lz_channels: list[int] | None = None, lz_decimate: int = 2) -> dict:
    """Features for one epoch.

    eeg_uv : array (channels, samples), microvolts, already band-passed 1-45 Hz.
    Returns scalars averaged over channels: log10 broadband and band powers, aperiodic slope,
    and LZ complexity (computed on `lz_channels`, after decimating to keep it fast).
    """
    freqs, pxx = psd(eeg_uv, fs)
    out = {"log_broadband": float(np.mean(np.log10(band_power(freqs, pxx, 1, 45))))}
    for name, (lo, hi) in BANDS.items():
        out[f"log_{name}"] = float(np.mean(np.log10(band_power(freqs, pxx, lo, hi))))
    out["slope"] = float(np.mean(aperiodic_slope(freqs, pxx)))
    idx = range(eeg_uv.shape[0]) if lz_channels is None else lz_channels
    out["lz"] = float(np.mean([lz_complexity(eeg_uv[i, ::lz_decimate]) for i in idx]))
    return out


def auc(scores: np.ndarray, labels: np.ndarray) -> float:
    """Area under the ROC curve from the rank-sum statistic (labels are 0/1)."""
    scores = np.asarray(scores, dtype=float)
    labels = np.asarray(labels).astype(bool)
    n1, n0 = labels.sum(), (~labels).sum()
    if n1 == 0 or n0 == 0:
        return float("nan")
    order = scores.argsort()
    ranks = np.empty_like(order, dtype=float)
    ranks[order] = np.arange(1, scores.size + 1)
    # average ranks for ties
    _, inv, counts = np.unique(scores, return_inverse=True, return_counts=True)
    sums = np.bincount(inv, weights=ranks)
    ranks = (sums / counts)[inv]
    return float((ranks[labels].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def lda_fit(X: np.ndarray, y: np.ndarray, shrink: float = 0.1):
    """Two-class linear discriminant with a shrunk pooled covariance. Returns (w, b)."""
    y = np.asarray(y).astype(bool)
    m1, m0 = X[y].mean(axis=0), X[~y].mean(axis=0)
    Xc = np.vstack([X[y] - m1, X[~y] - m0])
    cov = Xc.T @ Xc / max(1, Xc.shape[0] - 2)
    cov = (1 - shrink) * cov + shrink * np.eye(cov.shape[0]) * np.trace(cov) / cov.shape[0]
    w = np.linalg.solve(cov, m1 - m0)
    b = -0.5 * (m1 + m0) @ w
    return w, b
