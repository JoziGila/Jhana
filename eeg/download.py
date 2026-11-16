"""Download (part of) the open jhana EEG dataset.

Fabus MS, Zerfas S, Gruver A, Fini M, Gadaev T, Devaney KJ (2026).
"Electroencephalogram recordings in Jhana states: An open dataset". bioRxiv,
doi:10.64898/2026.06.27.734949. CC-BY. Code: https://github.com/tamazgadaev/jhana_eeg

The data lives in a public Google Drive folder in BIDS-EEG layout (EDF + events.tsv), about
71 sessions from 26 expert meditators. The full set is large, so by default this fetches all the
small metadata files and one or two EEG sessions per subject.

    python3 eeg/download.py                 # metadata + up to 1 session per subject
    python3 eeg/download.py --per-subject 2
    python3 eeg/download.py --all           # everything (many GB)

Files land in eeg/data/jhana_eeg/ (git-ignored). Needs: pip install gdown
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time

FOLDER_ID = "1PM5lDLJr2LKleADL9zM65HOQY8ykYg2_"
HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(HERE, "data", "jhana_eeg")
INDEX = os.path.join(HERE, "data", "index.json")


def list_files():
    import gdown

    os.makedirs(os.path.dirname(INDEX), exist_ok=True)
    if os.path.exists(INDEX):
        with open(INDEX) as f:
            return json.load(f)
    files = gdown.download_folder(id=FOLDER_ID, output=DEST, skip_download=True, quiet=True)
    index = [{"id": f.id, "path": f.path} for f in files]
    with open(INDEX, "w") as f:
        json.dump(index, f, indent=1)
    return index


def fetch(entry, retries=3):
    import gdown

    out = os.path.join(DEST, entry["path"])
    if os.path.exists(out) and os.path.getsize(out) > 0:
        return "cached"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    for attempt in range(retries):
        try:
            got = gdown.download(id=entry["id"], output=out, quiet=True)
            if got and os.path.exists(out) and os.path.getsize(out) > 0:
                return "ok"
        except Exception as exc:  # network hiccups and Drive quota pages
            err = str(exc).splitlines()[0][:120]
            print(f"  retry {attempt + 1}: {entry['path']}: {err}", file=sys.stderr)
        time.sleep(2 + 3 * attempt)
    return "failed"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--per-subject", type=int, default=1, help="EEG sessions to fetch per subject")
    ap.add_argument("--subjects", type=str, default="", help="comma-separated subject numbers, e.g. 1,2,8")
    ap.add_argument("--all", action="store_true", help="fetch every session")
    ap.add_argument("--metadata-only", action="store_true")
    args = ap.parse_args()

    index = list_files()
    edf = [e for e in index if e["path"].endswith(".edf")]
    small = [e for e in index if not e["path"].endswith((".edf", ".gz"))]
    physio = [e for e in index if e["path"].endswith(".gz")]
    print(f"{len(index)} files listed: {len(edf)} EEG sessions, {len(physio)} physio files, {len(small)} metadata files")

    counts = {"ok": 0, "cached": 0, "failed": 0}
    for e in small:
        counts[fetch(e)] += 1
    print("metadata:", counts)
    if args.metadata_only:
        return

    want_subjects = {f"sub-{int(s):02d}" for s in args.subjects.split(",") if s.strip()}
    per = {}
    chosen = []
    for e in sorted(edf, key=lambda x: x["path"]):
        sub = re.match(r"(sub-\d+)", e["path"]).group(1)
        if want_subjects and sub not in want_subjects:
            continue
        if args.all or per.get(sub, 0) < args.per_subject:
            per[sub] = per.get(sub, 0) + 1
            chosen.append(e)
    sessions = {os.path.dirname(e["path"]) for e in chosen}
    chosen += [e for e in physio if os.path.dirname(e["path"]) in sessions]

    counts = {"ok": 0, "cached": 0, "failed": 0}
    for i, e in enumerate(chosen, 1):
        status = fetch(e)
        counts[status] += 1
        size = os.path.getsize(os.path.join(DEST, e["path"])) / 1e6 if status != "failed" else 0
        print(f"[{i}/{len(chosen)}] {status:7s} {size:7.1f} MB  {e['path']}", flush=True)
    print("recordings:", counts)


if __name__ == "__main__":
    main()
