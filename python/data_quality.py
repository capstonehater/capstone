"""Report anomalies without changing genuine bulk orders or inventing demand."""
import numpy as np


def assess(series, censored_dates=()):
    recent = series.qty.to_numpy(dtype=float)
    positives = recent[recent > 0]
    flagged = []
    if len(positives) >= 20:
        median = float(np.median(positives))
        mad = float(np.median(np.abs(positives - median)))
        cutoff = median + max(6 * 1.4826 * mad, 3 * median)
        flagged = [str(row.Date.date()) for row in series.itertuples() if row.qty > cutoff]
    supplied = sorted(set(censored_dates))
    return {'outlierDatesForReview': flagged, 'outlierTreatment': 'flagged; observed quantities retained',
        'verifiedStockoutDates': supplied, 'stockoutTreatment': 'requires a censored-demand model before these dates can be treated as demand observations',
        'inventoryZeroIsNotProofOfZeroDemand': True, 'unknownCalendarDaysAreNotZeroDemand': True}
