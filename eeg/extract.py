"""Extract per-epoch features from the open jhana EEG dataset (Fabus et al. 2026).

    python3 eeg/extract.py            # reads eeg/data/jhana_eeg, writes eeg/results/features_real.csv

Each session's event markers are turned into labelled segments (a marker's state lasts until the
next marker). Segments are cut into 8-second epochs, band-passed 1-45 Hz, screened for large
artifacts, and summarised with the features in eeg/features.py for two channel sets:

    full   all scalp EEG channels (power, slope) and 16 spread-out channels (LZ)
    muse4  AF7, AF8, TP7, TP8 only: the nearest BioSemi-64 sites to a consumer headband's
           AF7, AF8, TP9, TP10

Also recorded per epoch: zygomaticus (smile muscle) EMG power, because smiling is common in the
first jhanas and muscle activity is a known confound for scalp EEG complexity and power.
"""

from __future__ import annotations

import csv
import glob
import os
import re
import sys
import warnings
from multiprocessing import Pool

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from features import bandpass, band_power, epoch_features, psd  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "jhana_eeg")
OUT = os.path.join(HERE, "results", "features_real.csv")

EPOCH_S = 8.0
SKIP_START_S = 15.0  # let the state settle after the marker
SKIP_END_S = 3.0
MAX_EPOCHS = 36  # per session and condition
REJECT_UV = 150.0  # peak-to-peak, on the muse4 + LZ channels
MUSE4 = ["AF7", "AF8", "TP7", "TP8"]
LZ16 = ["Fp1", "Fp2", "F3", "F4", "Fz", "C3", "C4", "Cz", "T7", "T8", "P3", "P4", "Pz", "O1", "O2", "Oz"]

CONDITION = {
    "pre_meditation_plan_day_eyes_closed": "base_pre",
    "pre_meditation_subtract_13": "base_pre",
    "pre_meditation_mind_wandering": "base_pre",
    "post_meditation_plan_day_eyes_closed": "base_post",
    "post_meditation_subtract_13": "base_post",
    "post_meditation_mind_wandering": "base_post",
    "AC": "AC",
    "AC_deepen": "AC",
    "metta_start": "metta",
    "J1": "J1",
    "J1_deepen": "J1",
    "J2": "J2",
    "J2_deepen": "J2",
    "J3": "J3",
    "J3_deepen": "J3",
    "J4": "J4",
    "J4_deepen": "J4",
}
TASK = {  # finer label for the baselines, to compare like with like
    "pre_meditation_plan_day_eyes_closed": "plan",
    "post_meditation_plan_day_eyes_closed": "plan",
    "pre_meditation_subtract_13": "arith",
    "post_meditation_subtract_13": "arith",
    "pre_meditation_mind_wandering": "wander",
    "post_meditation_mind_wandering": "wander",
}


def read_events(path):
    with open(path) as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    segs = []
    for a, b in zip(rows, rows[1:]):
        label = a["trial_type"]
        if label in CONDITION:
            segs.append((label, float(a["onset"]), float(b["onset"])))
    return segs


def participants():
    out = {}
    with open(os.path.join(DATA, "participants.tsv")) as f:
        for r in csv.DictReader(f, delimiter="\t"):
            out[r["participant_id"]] = r
    return out


def process(edf_path):
    import mne

    warnings.filterwarnings("ignore")
    mne.set_log_level("ERROR")
    sub = re.search(r"(sub-\d+)", edf_path).group(1)
    ses = re.search(r"(ses-\d+)", edf_path).group(1)
    segs = read_events(edf_path.replace("_eeg.edf", "_events.tsv"))
    raw = mne.io.read_raw_edf(edf_path, preload=False)
    fs = float(raw.info["sfreq"])
    names = raw.ch_names
    with open(edf_path.replace("_eeg.edf", "_channels.tsv")) as f:
        types = {r["name"]: r["type"] for r in csv.DictReader(f, delimiter="\t")}
    eeg_names = [n for n in names if types.get(n) == "EEG"]
    if not all(c in eeg_names for c in MUSE4):
        return []
    eeg_idx = [names.index(n) for n in eeg_names]
    muse_local = [eeg_names.index(c) for c in MUSE4]
    lz_local = [eeg_names.index(c) for c in LZ16 if c in eeg_names]
    emg_idx = names.index("zygomaticus_left") if "zygomaticus_left" in names else None
    n_ep = int(EPOCH_S * fs)
    rows = []
    per_cond = {}
    for seg_i, (label, t0, t1) in enumerate(segs):
        cond = CONDITION[label]
        a, b = t0 + SKIP_START_S, min(t1 - SKIP_END_S, raw.times[-1])
        if b - a < EPOCH_S:
            continue
        start, stop = int(a * fs), int(b * fs)
        data = raw.get_data(picks=eeg_idx, start=start, stop=stop) * 1e6  # microvolts
        data = bandpass(data, fs)
        emg = None
        if emg_idx is not None:
            emg = raw.get_data(picks=[emg_idx], start=start, stop=stop)[0] * 1e6
        n_epochs = data.shape[1] // n_ep
        for e in range(n_epochs):
            x = data[:, e * n_ep : (e + 1) * n_ep]
            check = x[sorted(set(muse_local + lz_local))]
            ptp = check.max(axis=1) - check.min(axis=1)
            if ptp.max() > REJECT_UV or ptp.min() < 0.5:
                continue
            full = epoch_features(x, fs, lz_channels=lz_local)
            muse = epoch_features(x[muse_local], fs)
            row = {
                "subject": sub,
                "session": ses,
                "condition": cond,
                "label": label,
                "task": TASK.get(label, ""),
                "segment": seg_i,
                "t_mid": round(a + (e + 0.5) * EPOCH_S, 1),
            }
            row.update({f"full_{k}": round(v, 5) for k, v in full.items()})
            row.update({f"muse4_{k}": round(v, 5) for k, v in muse.items()})
            if emg is not None:
                seg = emg[e * n_ep : (e + 1) * n_ep]
                f_, p_ = psd(seg - seg.mean(), fs)
                row["emg_zyg_log"] = round(float(np.log10(max(band_power(f_, p_, 30, 110), 1e-12))), 5)
            else:
                row["emg_zyg_log"] = ""
            per_cond.setdefault(cond, []).append(row)
    for cond, items in per_cond.items():
        if len(items) > MAX_EPOCHS:  # keep an evenly spaced subset
            keep = np.linspace(0, len(items) - 1, MAX_EPOCHS).round().astype(int)
            items = [items[i] for i in keep]
        rows.extend(items)
    return rows


def main():
    edfs = sorted(glob.glob(os.path.join(DATA, "sub-*", "ses-*", "eeg", "*_eeg.edf")))
    if not edfs:
        print("No EEG files under eeg/data/jhana_eeg. Run: python3 eeg/download.py")
        return 1
    people = participants()
    print(f"extracting features from {len(edfs)} sessions …", flush=True)
    with Pool(min(4, os.cpu_count() or 1)) as pool:
        results = []
        for i, rows in enumerate(pool.imap(process, edfs), 1):
            results.extend(rows)
            print(f"  [{i}/{len(edfs)}] {os.path.basename(edfs[i - 1])}: {len(rows)} epochs", flush=True)
    for r in results:
        p = people.get(r["subject"], {})
        r["retreat"] = p.get("retreat_name", "")
        r["hours"] = p.get("lifetime_meditation_hours", "")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    fields = list(results[0].keys())
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(results)
    print(f"wrote {len(results)} epochs to {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
