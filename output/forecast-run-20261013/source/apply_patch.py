"""Apply the forecasting improvements to your main SARIMA script.

Usage:  python apply_patch.py your_main_script.py
Writes  your_main_script.py.bak (backup) and patches the file in place.
Every edit is anchored to exact text; if any anchor is missing or ambiguous the
script stops WITHOUT changing anything.
"""
import sys
from pathlib import Path

EDITS = []

def edit(old, new, label):
    EDITS.append((old, new, label))

# 1. Selection settings ------------------------------------------------------
edit('"CV_FOLDS": 3,', '"CV_FOLDS": 4,', "CV_FOLDS 3 -> 4 (28 validation days, steadier selection)")
edit('"OPERATIONAL_ERROR_TOLERANCE": 0.10,', '"OPERATIONAL_ERROR_TOLERANCE": 0.03,',
     "OPERATIONAL_ERROR_TOLERANCE 0.10 -> 0.03 (stay closer to lowest-MAPE model)")

# 2. Trim fake leading zeros per material ------------------------------------
edit('    series.index.name = "Date"\n    series = series.reset_index()',
     '    series.index.name = "Date"\n'
     '    # Drop the zero-filled period before this material was first used; it is\n'
     '    # missing history, not zero demand, and distorts the fit.\n'
     '    first_use = series.index[series["qty"] > 0]\n'
     '    if len(first_use):\n'
     '        series = series.loc[first_use[0]:]\n'
     '    series = series.reset_index()',
     "trim leading zeros")

# 3. Skip short series BEFORE the expensive grid search ----------------------
edit('    stationary = make_stationary(\n        history\n    )',
     '    if len(history) < CONFIG["MIN_HISTORY"]:\n'
     '        return {"history": history}   # caller skips it; avoids a wasted grid search\n'
     '    stationary = make_stationary(\n        history\n    )',
     "early MIN_HISTORY skip")

# 4. Held-out MAPE printing + summary ----------------------------------------
edit('    interval = training.get("interval_calibration", {})\n',
     '    interval = training.get("interval_calibration", {})\n'
     '    point = (interval.get("validation") or {}).get("pointMetrics") or {}\n'
     '    if point.get("mape") is not None:\n'
     '        print(f"Held-out MAPE (not used for selection): {point[\'mape\']:.2f}%")\n'
     '    ens = training.get("ensemble_top3")\n'
     '    if ens and ens.get("mape") is not None:\n'
     '        print(f"Top-3 blend MAPE (selection folds): {ens[\'mape\']:.2f}%")\n',
     "print held-out MAPE and blend MAPE")

edit('def evaluate_training(result):',
     'def heldout_summary(db):\n'
     '    """Median/mean held-out accuracy across all materials (selection-independent)."""\n'
     '    rows = []\n'
     '    for key, r in db.items():\n'
     '        v = (r["training"].get("interval_calibration") or {}).get("validation") or {}\n'
     '        p = v.get("pointMetrics") or {}\n'
     '        rows.append({"material": key, "mape": p.get("mape"),\n'
     '                     "wape": p.get("wape"), "bias": p.get("bias_pct")})\n'
     '    df = pd.DataFrame(rows)\n'
     '    print("\\n" + "=" * 70)\n'
     '    print("HELD-OUT SUMMARY (all materials)")\n'
     '    print("=" * 70)\n'
     '    cols = df[["mape", "wape", "bias"]].apply(pd.to_numeric, errors="coerce")\n'
     '    print(cols.describe().loc[["count", "mean", "50%"]].round(2).to_string())\n'
     '    print("=" * 70)\n'
     '    df.to_csv("heldout_summary.csv", index=False)\n'
     '    return df\n'
     '\n\n'
     'def evaluate_training(result):',
     "add heldout_summary()")

edit('\n    rank_models(forecast_database)\n',
     '\n    rank_models(forecast_database)\n    heldout_summary(forecast_database)\n',
     "call heldout_summary() in run_once")

def main(path):
    src = Path(path).read_text(encoding="utf-8")
    for old, _, label in EDITS:
        n = src.count(old)
        if n != 1:
            sys.exit(f"STOPPED - anchor for '{label}' found {n} times (need exactly 1). Nothing changed.")
    for old, new, label in EDITS:
        src = src.replace(old, new)
        print("applied:", label)
    Path(path + ".bak").write_text(Path(path).read_text(encoding="utf-8"), encoding="utf-8")
    Path(path).write_text(src, encoding="utf-8")
    print(f"\nDone. Backup saved as {path}.bak")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])