"""Add held-out 7-day-total accuracy (the number that matters for ordering).

Usage:  python apply_patch2.py SARIMA.py interval_calibration.py
Run apply_patch.py FIRST. Backs up both files (.bak2). Stops without changing
anything if any anchor is missing or ambiguous.
"""
import sys
from pathlib import Path

CAL, MAIN = [], []

CAL.append(('    evaluated_dates, fold_coverage, evaluation_steps, fold_details, baselines = [], [], [], [], []\n',
 '    evaluated_dates, fold_coverage, evaluation_steps, fold_details, baselines = [], [], [], [], []\n'
 '    period_totals = []  # (actual, forecast, last-week-baseline) 7-day totals per held-out period\n',
 "init period_totals"))
CAL.append(('            baselines.extend(baseline)\n',
 '            baselines.extend(baseline)\n'
 '            period_totals.append((float(test.qty.sum()), float(adjusted[:, 0].sum()), float(baseline.sum())))\n',
 "record period totals"))
CAL.append(('    for key, value in result["validation"]["pointMetrics"].items():\n',
 '    totals = np.asarray(period_totals, dtype=float)\n'
 '    actual_sum = float(totals[:, 0].sum())\n'
 '    positive_periods = totals[:, 0] > 0\n'
 '    result["validation"]["weeklyTotal"] = {\n'
 '        "periods": int(len(totals)),\n'
 '        "wape": float(np.abs(totals[:, 1] - totals[:, 0]).sum() / actual_sum * 100) if actual_sum > 0 else None,\n'
 '        "biasPercent": float((totals[:, 1].sum() - actual_sum) / actual_sum * 100) if actual_sum > 0 else None,\n'
 '        "mape": float(np.mean(np.abs(totals[positive_periods, 1] - totals[positive_periods, 0]) / totals[positive_periods, 0]) * 100) if positive_periods.any() else None,\n'
 '        "baselineWape": float(np.abs(totals[:, 2] - totals[:, 0]).sum() / actual_sum * 100) if actual_sum > 0 else None}\n'
 '    for key, value in result["validation"]["pointMetrics"].items():\n',
 "compute weeklyTotal"))

MAIN.append(('    ens = training.get("ensemble_top3")\n',
 '    week = (interval.get("validation") or {}).get("weeklyTotal") or {}\n'
 '    if week.get("wape") is not None:\n'
 '        print(f"Held-out 7-day total error (WAPE): {week[\'wape\']:.2f}%  "\n'
 '              f"(repeat-last-week baseline: {week[\'baselineWape\']:.2f}%)")\n'
 '    ens = training.get("ensemble_top3")\n',
 "print 7-day total error"))
MAIN.append(('                     "wape": p.get("wape"), "bias": p.get("bias_pct")})\n',
 '                     "wape": p.get("wape"), "bias": p.get("bias_pct"),\n'
 '                     "week_wape": (v.get("weeklyTotal") or {}).get("wape"),\n'
 '                     "week_bias": (v.get("weeklyTotal") or {}).get("biasPercent"),\n'
 '                     "naive_week_wape": (v.get("weeklyTotal") or {}).get("baselineWape")})\n',
 "collect weekly columns"))
MAIN.append(('    cols = df[["mape", "wape", "bias"]].apply(pd.to_numeric, errors="coerce")',
 '    cols = df[["mape", "wape", "bias", "week_wape", "week_bias", "naive_week_wape"]].apply(pd.to_numeric, errors="coerce")',
 "summary columns"))

def check(src, edits, name):
    for old, _, label in edits:
        n = src.count(old)
        if n != 1:
            sys.exit(f"STOPPED - {name}: anchor '{label}' found {n} times (need 1). Nothing changed.")

def run(src, edits):
    for old, new, label in edits:
        src = src.replace(old, new); print("applied:", label)
    return src

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main_path, cal_path = sys.argv[1], sys.argv[2]
    main_src = Path(main_path).read_text(encoding="utf-8")
    cal_src = Path(cal_path).read_text(encoding="utf-8")
    check(main_src, MAIN, main_path); check(cal_src, CAL, cal_path)
    for path, src in ((main_path, main_src), (cal_path, cal_src)):
        Path(path + ".bak2").write_text(src, encoding="utf-8")
    Path(cal_path).write_text(run(cal_src, CAL), encoding="utf-8")
    Path(main_path).write_text(run(main_src, MAIN), encoding="utf-8")
    print("\nDone. Backups: *.bak2")