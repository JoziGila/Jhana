"""Test the published jhana EEG signatures on extracted features, and ask whether a consumer-like
four-channel montage could support feedback across people.

    python3 eeg/stats.py                 # uses eeg/results/features_real.csv if present
    python3 eeg/stats.py --simulated     # uses clearly labelled SIMULATED features instead

Writes eeg/results/summary.json and eeg/results/REPORT.md.

Design choices that matter for interpretation:
  - The unit of analysis is the SUBJECT (one session each). Epochs are averaged within subject
    and condition before any test.
  - Baseline = eyes-closed non-meditative tasks recorded BEFORE and AFTER the sit. Using both
    guards against mistaking time-on-task drift for a jhana effect.
  - The pre-vs-post baseline contrast is run through the same machinery as a NEGATIVE CONTROL.
  - Zygomaticus EMG (smile muscle) is tested as a rival explanation.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys

import numpy as np
from scipy import stats as sps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from features import auc, lda_fit  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REAL = os.path.join(HERE, "results", "features_real.csv")
FEATS = ["log_broadband", "lz", "slope", "log_delta", "log_theta", "log_alpha", "log_beta", "log_gamma"]
JHANAS = ["J1", "J2", "J3", "J4"]


def load(path):
    with open(path) as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        for k, v in r.items():
            if k.startswith(("full_", "muse4_")) or k in ("emg_zyg_log", "t_mid"):
                r[k] = float(v) if v not in ("", None) else np.nan
    return rows


def subject_means(rows, key, conds):
    """{subject: mean of `key` over epochs whose condition is in conds}"""
    acc = {}
    for r in rows:
        if r["condition"] in conds and np.isfinite(r[key]):
            acc.setdefault(r["subject"], []).append(r[key])
    return {s: float(np.mean(v)) for s, v in acc.items() if len(v) >= 4}


def paired(rows, key, conds_a, conds_b, rng):
    a, b = subject_means(rows, key, conds_a), subject_means(rows, key, conds_b)
    subs = sorted(set(a) & set(b))
    if len(subs) < 5:
        return None
    d = np.array([a[s] - b[s] for s in subs])
    t, p = sps.ttest_1samp(d, 0.0)
    try:
        w_p = float(sps.wilcoxon(d).pvalue)
    except ValueError:
        w_p = float("nan")
    boots = [rng.choice(d, size=d.size, replace=True).mean() for _ in range(4000)]
    return {
        "n": len(subs),
        "mean_diff": float(d.mean()),
        "ci95": [float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))],
        "dz": float(d.mean() / d.std(ddof=1)) if d.std(ddof=1) > 0 else float("nan"),
        "p_t": float(p),
        "p_wilcoxon": w_p,
        "share_positive": float((d > 0).mean()),
    }


def matrix(rows, prefix, pos, neg, relative_to=("base_pre",), feats=FEATS):
    """Epoch-level design matrix, each feature expressed relative to that subject's own pre-sit
    baseline (mean and SD). This is what a deployed system could do after a two-minute calibration."""
    X, y, g = [], [], []
    by_sub = {}
    for r in rows:
        by_sub.setdefault(r["subject"], []).append(r)
    for sub, rs in by_sub.items():
        ref = [r for r in rs if r["condition"] in relative_to]
        if len(ref) < 6:
            continue
        mu = np.array([np.nanmean([r[f"{prefix}_{f}"] for r in ref]) for f in feats])
        sd = np.array([np.nanstd([r[f"{prefix}_{f}"] for r in ref]) for f in feats])
        sd[sd == 0] = 1.0
        for r in rs:
            lab = 1 if r["condition"] in pos else 0 if r["condition"] in neg else None
            if lab is None:
                continue
            v = (np.array([r[f"{prefix}_{f}"] for f in feats]) - mu) / sd
            if np.all(np.isfinite(v)):
                X.append(v)
                y.append(lab)
                g.append(sub)
    return np.array(X), np.array(y), np.array(g)


def loso_auc(X, y, g):
    """Leave-one-subject-out: train on everyone else, score the held-out person.
    Returns the mean per-subject AUC, its SD, and the pooled AUC."""
    per, scores_all, y_all = [], [], []
    for sub in np.unique(g):
        test = g == sub
        if y[test].min() == y[test].max() or y[~test].min() == y[~test].max():
            continue
        w, b = lda_fit(X[~test], y[~test])
        s = X[test] @ w + b
        per.append(auc(s, y[test]))
        scores_all.extend(s)
        y_all.extend(y[test])
    if not per:
        return None
    return {"subjects": len(per), "mean_auc": float(np.mean(per)), "sd_auc": float(np.std(per)),
            "pooled_auc": auc(np.array(scores_all), np.array(y_all)),
            "share_above_0.7": float(np.mean(np.array(per) > 0.7))}


def within_auc(X, y, g):
    """Within-subject, split-half by time order (first half trains, second half tests, and the
    reverse). An optimistic upper bound: it needs labelled jhana data from the same person."""
    per = []
    for sub in np.unique(g):
        m = g == sub
        Xs, ys = X[m], y[m]
        idx1 = np.concatenate([np.where(ys == c)[0][: (ys == c).sum() // 2] for c in (0, 1)])
        idx2 = np.setdiff1d(np.arange(ys.size), idx1)
        vals = []
        for tr, te in ((idx1, idx2), (idx2, idx1)):
            if ys[tr].min() == ys[tr].max() or ys[te].min() == ys[te].max() or len(tr) < 8:
                continue
            w, b = lda_fit(Xs[tr], ys[tr], shrink=0.3)
            vals.append(auc(Xs[te] @ w + b, ys[te]))
        if vals:
            per.append(np.mean(vals))
    return {"subjects": len(per), "mean_auc": float(np.mean(per)), "sd_auc": float(np.std(per))} if per else None


def emg_auc(rows, pos, neg):
    """How well does smile-muscle EMG alone separate the two conditions, per subject?"""
    per = []
    by = {}
    for r in rows:
        if np.isfinite(r["emg_zyg_log"]):
            by.setdefault(r["subject"], []).append(r)
    for rs in by.values():
        s = np.array([r["emg_zyg_log"] for r in rs if r["condition"] in pos + neg])
        y = np.array([1 if r["condition"] in pos else 0 for r in rs if r["condition"] in pos + neg])
        if y.size >= 10 and y.min() != y.max():
            per.append(auc(s, y))
    return {"subjects": len(per), "mean_auc": float(np.mean(per)), "mean_abs_dev": float(np.mean(np.abs(np.array(per) - 0.5)))} if per else None


def single_feature_auc(rows, key, pos, neg, sign=1):
    """Per-subject AUC of ONE feature with a fixed direction (no training): the simplest possible
    feedback signal. sign=+1 means 'higher = first condition'."""
    by = {}
    for r in rows:
        if r["condition"] in pos + neg and np.isfinite(r[key]):
            by.setdefault(r["subject"], []).append(r)
    per = []
    for rs in by.values():
        y = np.array([1 if r["condition"] in pos else 0 for r in rs])
        if y.size >= 10 and y.min() != y.max():
            per.append(auc(sign * np.array([r[key] for r in rs]), y))
    if not per:
        return None
    per = np.array(per)
    return {"subjects": int(per.size), "mean_auc": float(per.mean()), "sd_auc": float(per.std()), "share_above_0.7": float((per > 0.7).mean()), "share_below_0.5": float((per < 0.5).mean())}


def emg_coupling(rows, key, pos, neg):
    """Across subjects: does the size of a person's EEG effect track the size of their smile-muscle
    effect? A strong correlation means the EEG effect may be partly muscle."""
    a, b = subject_means(rows, key, pos), subject_means(rows, key, neg)
    ea, eb = subject_means(rows, "emg_zyg_log", pos), subject_means(rows, "emg_zyg_log", neg)
    subs = sorted(set(a) & set(b) & set(ea) & set(eb))
    if len(subs) < 8:
        return None
    x = np.array([ea[s] - eb[s] for s in subs])
    y = np.array([a[s] - b[s] for s in subs])
    r, p = sps.spearmanr(x, y)
    return {"n": len(subs), "spearman_r": float(r), "p": float(p)}


def simulated_rows(seed=7, subjects=24):
    """SIMULATED features with the published effects built in (for running the pipeline without
    the dataset). Effects: LZ up, broadband power down, slope flatter in jhana; large stable
    differences between people. NOT EVIDENCE OF ANYTHING."""
    rng = np.random.default_rng(seed)
    rows = []
    conds = ["base_pre", "AC", "J1", "J2", "J3", "J4", "base_post"]
    shift = {"base_pre": 0, "AC": 0.3, "J1": 0.8, "J2": 1.0, "J3": 1.0, "J4": 1.1, "base_post": 0.1}
    for s in range(subjects):
        person = rng.normal(0, 1, len(FEATS))
        gain = rng.normal(1, 0.5)
        for c in conds:
            for e in range(24):
                r = {"subject": f"sim-{s:02d}", "session": "ses-01", "condition": c, "label": c, "task": "", "segment": 0,
                     "t_mid": float(e), "retreat": "SIM", "hours": "", "emg_zyg_log": float(rng.normal(0.3 * (c == "J1"), 1))}
                for prefix, noise in (("full", 0.5), ("muse4", 0.9)):
                    eff = shift[c] * gain
                    vals = person + rng.normal(0, noise, len(FEATS))
                    vals[FEATS.index("lz")] += 0.6 * eff
                    vals[FEATS.index("log_broadband")] -= 0.6 * eff
                    vals[FEATS.index("slope")] += 0.4 * eff
                    for f, v in zip(FEATS, vals):
                        r[f"{prefix}_{f}"] = float(v)
                rows.append(r)
    return rows


def fmt(x, nd=2):
    return "n/a" if x is None or (isinstance(x, float) and not np.isfinite(x)) else f"{x:.{nd}f}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--simulated", action="store_true")
    args = ap.parse_args()
    use_real = os.path.exists(REAL) and not args.simulated
    rows = load(REAL) if use_real else simulated_rows()
    source = "REAL: open dataset of Fabus et al. 2026 (one session per subject)" if use_real else "SIMULATED: synthetic features with the published effects built in. Not evidence."
    rng = np.random.default_rng(11)
    base = ["base_pre", "base_post"]
    out = {"source": source, "real": use_real, "epochs": len(rows), "subjects": len({r["subject"] for r in rows})}
    out["epochs_by_condition"] = {c: sum(r["condition"] == c for r in rows) for c in sorted({r["condition"] for r in rows})}

    # 1. signatures, subject level
    out["signatures"] = {}
    for prefix in ("full", "muse4"):
        for name, a, b in (("jhana_vs_baseline", JHANAS, base), ("jhana_vs_access", JHANAS, ["AC"]),
                           ("J1_vs_baseline", ["J1"], base), ("J4_vs_baseline", ["J4"], base),
                           ("control_post_vs_pre_baseline", ["base_post"], ["base_pre"])):
            for f in ("log_broadband", "lz", "slope", "log_alpha", "log_gamma"):
                out["signatures"][f"{prefix}:{name}:{f}"] = paired(rows, f"{prefix}_{f}", a, b, rng)
    out["emg"] = {
        "J1_vs_baseline_paired": paired(rows, "emg_zyg_log", ["J1"], base, rng),
        "jhana_vs_baseline_paired": paired(rows, "emg_zyg_log", JHANAS, base, rng),
        "J1_vs_baseline_auc": emg_auc(rows, ["J1"], base),
        "jhana_vs_baseline_auc": emg_auc(rows, JHANAS, base),
    }

    out["single_feature"] = {}
    out["emg_coupling"] = {}
    for prefix in ("full", "muse4"):
        for f, sign in (("lz", 1), ("slope", 1), ("log_broadband", -1), ("log_alpha", -1)):
            for name, pos, neg in (("jhana_vs_baseline", JHANAS, base), ("jhana_vs_access", JHANAS, ["AC"]), ("control_post_vs_pre_baseline", ["base_post"], ["base_pre"])):
                out["single_feature"][f"{prefix}:{name}:{f}"] = single_feature_auc(rows, f"{prefix}_{f}", pos, neg, sign)
        for f in ("lz", "slope", "log_broadband", "log_gamma", "log_alpha"):
            out["emg_coupling"][f"{prefix}:J1_vs_baseline:{f}"] = emg_coupling(rows, f"{prefix}_{f}", ["J1"], base)
            out["emg_coupling"][f"{prefix}:jhana_vs_baseline:{f}"] = emg_coupling(rows, f"{prefix}_{f}", JHANAS, base)

    # 2. decoding
    out["decoding"] = {}
    for prefix in ("full", "muse4"):
        for name, pos, neg in (("jhana_vs_baseline", JHANAS, base), ("jhana_vs_access", JHANAS, ["AC"]),
                               ("control_post_vs_pre_baseline", ["base_post"], ["base_pre"])):
            X, y, g = matrix(rows, prefix, pos, neg)
            if len(y) < 40:
                continue
            out["decoding"][f"{prefix}:{name}"] = {"epochs": int(len(y)), "cross_subject": loso_auc(X, y, g), "within_subject": within_auc(X, y, g)}
        # without the high-frequency features most exposed to muscle
        robust = ["log_broadband", "lz", "slope", "log_delta", "log_theta", "log_alpha"]
        X, y, g = matrix(rows, prefix, JHANAS, base, feats=["log_delta", "log_theta", "log_alpha"])
        if len(y) >= 40:
            out["decoding"][f"{prefix}:jhana_vs_baseline:low_freq_only"] = {"epochs": int(len(y)), "cross_subject": loso_auc(X, y, g)}

    os.makedirs(os.path.join(HERE, "results"), exist_ok=True)
    tag = "" if use_real else "_simulated"
    with open(os.path.join(HERE, "results", f"summary{tag}.json"), "w") as f:
        json.dump(out, f, indent=1)

    # ---- report ----
    L = []
    L.append("# EEG signatures of jhana: a check on open data\n")
    L.append(f"**Data source: {source}**\n")
    if not use_real:
        L.append("> This report was generated from simulated numbers so that the pipeline can run without the\n> dataset. Nothing below is a finding. Run `python3 eeg/download.py && python3 eeg/extract.py` for real data.\n")
    L.append(f"Subjects: {out['subjects']}. Epochs (8 s, artifact-screened): {out['epochs']}. By condition: "
             + ", ".join(f"{k} {v}" for k, v in out["epochs_by_condition"].items()) + ".\n")
    L.append("Generated by `python3 eeg/stats.py`. Methods and caveats are at the end.\n")

    def sig_table(prefix, title):
        L.append(f"## {title}\n")
        L.append("Paired across subjects (each subject's mean in the first condition minus their mean in the second).\n")
        L.append("| Contrast | Feature | n | Mean difference [95% CI] | dz | p (t) | p (Wilcoxon) | Subjects in this direction |")
        L.append("|---|---|---|---|---|---|---|---|")
        names = {"log_broadband": "Broadband power (log10)", "lz": "Lempel-Ziv complexity", "slope": "Aperiodic slope (higher = flatter)", "log_alpha": "Alpha power (log10)", "log_gamma": "Gamma 30–45 Hz (log10)"}
        for contrast in ("jhana_vs_baseline", "jhana_vs_access", "J1_vs_baseline", "J4_vs_baseline", "control_post_vs_pre_baseline"):
            for f in ("log_broadband", "lz", "slope", "log_alpha", "log_gamma"):
                r = out["signatures"].get(f"{prefix}:{contrast}:{f}")
                if not r:
                    continue
                share = r["share_positive"] if r["mean_diff"] > 0 else 1 - r["share_positive"]
                L.append(f"| {contrast.replace('_', ' ')} | {names[f]} | {r['n']} | {r['mean_diff']:+.3f} [{r['ci95'][0]:+.3f}, {r['ci95'][1]:+.3f}] | {fmt(r['dz'])} | {r['p_t']:.3g} | {r['p_wilcoxon']:.3g} | {share:.0%} |")
        L.append("")

    sig_table("full", "1. Do the published signatures hold across subjects? (64-channel)")
    sig_table("muse4", "2. The same with four channels (AF7, AF8, TP7, TP8)")

    L.append("## 3. Could this drive feedback? Decoding jhana from baseline\n")
    L.append("Epoch-level linear classifier on eight features, each expressed relative to the person's own pre-sit baseline. AUC 0.5 is chance.\n")
    L.append("| Montage | Task | Epochs | Cross-subject AUC, mean ± SD over held-out people | Share of people with AUC > 0.7 | Within-subject AUC (needs that person's labelled jhana) |")
    L.append("|---|---|---|---|---|---|")
    for key, d in out["decoding"].items():
        prefix, task = key.split(":", 1)
        cs, ws = d.get("cross_subject"), d.get("within_subject")
        L.append(f"| {'64-ch' if prefix == 'full' else '4-ch'} | {task.replace('_', ' ').replace(':', ', ')} | {d['epochs']} | "
                 + (f"{cs['mean_auc']:.2f} ± {cs['sd_auc']:.2f} (n={cs['subjects']})" if cs else "n/a") + " | "
                 + (f"{cs['share_above_0.7']:.0%}" if cs else "n/a") + " | "
                 + (f"{ws['mean_auc']:.2f} ± {ws['sd_auc']:.2f}" if ws else "n/a") + " |")
    L.append("")
    L.append("### One feature, fixed direction, no training\n")
    L.append("The simplest feedback signal: is this epoch's value higher (or lower) than the comparison epochs from the same person? Mean per-subject AUC.\n")
    L.append("| Montage | Feature (direction counted as jhana) | Jhana vs baseline | Jhana vs access concentration | Control: post vs pre baseline |")
    L.append("|---|---|---|---|---|")
    fname = {"lz": "LZ complexity (higher)", "slope": "Aperiodic slope (flatter)", "log_broadband": "Broadband power (lower)", "log_alpha": "Alpha power (lower)"}
    for prefix in ("full", "muse4"):
        for f in ("lz", "slope", "log_broadband", "log_alpha"):
            cells = []
            for name in ("jhana_vs_baseline", "jhana_vs_access", "control_post_vs_pre_baseline"):
                r = out["single_feature"].get(f"{prefix}:{name}:{f}")
                cells.append(f"{r['mean_auc']:.2f} ± {r['sd_auc']:.2f} (n={r['subjects']}; {r['share_below_0.5']:.0%} of people go the other way)" if r else "n/a")
            L.append(f"| {'64-ch' if prefix == 'full' else '4-ch'} | {fname[f]} | " + " | ".join(cells) + " |")
    L.append("")
    L.append("## 4. The smile confound\n")
    e = out["emg"]
    for label, k in (("J1 vs baseline", "J1_vs_baseline"), ("All jhanas vs baseline", "jhana_vs_baseline")):
        p_, a_ = e.get(f"{k}_paired"), e.get(f"{k}_auc")
        if p_:
            L.append(f"- **{label}, zygomaticus EMG power:** mean difference {p_['mean_diff']:+.3f} log10 units [{p_['ci95'][0]:+.3f}, {p_['ci95'][1]:+.3f}], n={p_['n']}, p={p_['p_t']:.3g}; higher in jhana for {p_['share_positive']:.0%} of subjects."
                     + (f" EMG alone separates the two with a mean per-subject AUC of {a_['mean_auc']:.2f} (mean distance from chance {a_['mean_abs_dev']:.2f})." if a_ else ""))
    L.append("")
    L.append("Does a person's EEG effect scale with their smile-muscle effect? Spearman correlation across subjects between the EMG difference and the EEG feature difference (64-channel):\n")
    L.append("| Contrast | LZ | Slope | Broadband | Gamma | Alpha |")
    L.append("|---|---|---|---|---|---|")
    for name in ("J1_vs_baseline", "jhana_vs_baseline"):
        cells = []
        for f in ("lz", "slope", "log_broadband", "log_gamma", "log_alpha"):
            r = out["emg_coupling"].get(f"full:{name}:{f}")
            cells.append(f"r={r['spearman_r']:+.2f} (p={r['p']:.2g}, n={r['n']})" if r else "n/a")
        L.append(f"| {name.replace('_', ' ')} | " + " | ".join(cells) + " |")
    L.append("")
    L.append("## Methods\n")
    L.append("- One session per subject from the open dataset (BIDS, 64-channel BioSemi, 256 Hz, average reference). Segments are defined by the participants' own button presses.")
    L.append("- 8-second epochs, starting 15 s after each marker; 1–45 Hz band-pass; epochs with peak-to-peak above 150 µV on the analysed channels dropped; at most 36 evenly spaced epochs per subject and condition.")
    L.append("- Broadband and band power by Welch's method; aperiodic slope as a log-log fit over 2–40 Hz excluding 7–14 Hz; Lempel-Ziv (1976) complexity of the median-binarised signal at 128 Hz, normalised by n/log2(n), averaged over 16 scalp sites (64-ch) or the four sites (4-ch).")
    L.append("- Baseline = eyes-closed day-planning, mental arithmetic or mind-wandering, recorded before and after the sit.")
    L.append("- No correction for multiple comparisons: the three published signatures were the planned tests; alpha and gamma are descriptive.\n")
    L.append("## Caveats\n")
    L.append("- All participants are experts who enter jhana at will. Nothing here shows what a beginner's first entry looks like.")
    L.append("- State labels are self-reports. Order is fixed (baseline, access, J1…J4, baseline), so depth is confounded with time; the pre/post baseline control addresses drift only partly.")
    L.append("- Two teaching traditions are pooled (breath-based and loving-kindness-based).")
    L.append("- LZ complexity and spectral slope are mathematically related, and both are sensitive to muscle activity.")
    L.append("- One session per subject was used out of roughly three available; the rest of the dataset was not downloaded.")
    with open(os.path.join(HERE, "results", f"REPORT{tag}.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"{source}\nwrote eeg/results/summary{tag}.json and eeg/results/REPORT{tag}.md")
    k = out["signatures"].get("full:jhana_vs_baseline:lz")
    if k:
        print(f"  LZ jhana - baseline: {k['mean_diff']:+.3f} (dz {k['dz']:.2f}, p {k['p_t']:.3g}, n {k['n']})")
    d = out["decoding"].get("muse4:jhana_vs_baseline", {}).get("cross_subject")
    if d:
        print(f"  4-channel cross-subject AUC: {d['mean_auc']:.2f} ± {d['sd_auc']:.2f}")


if __name__ == "__main__":
    main()
