# One command runs everything:   make all
# Needs Node 20+ and Python 3.10+. The browser test is skipped if Playwright is not installed.

.PHONY: all deps test build e2e sim eeg power data clean

all: deps test build e2e sim eeg power
	@echo
	@echo "All done. Open dist/ember.html in a browser. Reports: eeg/results/REPORT.md, sim/results/POLICIES.md, study/POWER.md"

deps:
	@test -d node_modules || npm ci --no-audit --no-fund
	@python3 -c "import numpy, scipy" 2>/dev/null || python3 -m pip install --quiet -r requirements.txt

test: deps
	node --test "tests/*.test.js"
	python3 -m unittest eeg/test_features.py

build: deps
	node scripts/build.mjs

e2e: build
	node tests/e2e.mjs

# SIMULATED: coaching strategies compared on simulated meditators
sim: deps
	node sim/run_policies.mjs

# REAL if eeg/results/features_real.csv exists (it is committed), otherwise SIMULATED and labelled so
eeg: deps
	python3 eeg/stats.py

# ASSUMPTIONS, not data: power for the proposed study
power: deps
	python3 study/power.py

# Optional and large (about 5 GB for one session per subject): re-derive the EEG features from raw data
data:
	python3 -m pip install --quiet gdown mne
	python3 eeg/download.py --per-subject 1
	python3 eeg/extract.py

clean:
	rm -rf dist/screens eeg/results/*_simulated.* 
