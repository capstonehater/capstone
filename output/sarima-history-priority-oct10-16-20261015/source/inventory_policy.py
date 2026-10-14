"""Review-period demand quantiles and explicitly configured purchasing limits."""
import math
import numpy as np
from demand_portfolio import path_summary, finite_quantile


def recommend(existing, paths, config=None):
    config = config or {}
    result = dict(existing)
    if paths is None or not len(paths):
        result['quantilePolicy'] = {'status': 'unavailable', 'reason': 'No calibrated forecast error blocks'}
        return result
    paths = np.asarray(paths)
    review = int(config.get('reviewPeriodDays', min(7, paths.shape[1])))
    lead = config.get('leadTimeDays')
    level = float(config.get('serviceLevel', .8))
    if not .5 <= level < 1 or review < 1 or (lead is not None and (int(lead) != lead or lead < 0)):
        raise ValueError('Invalid inventory lead time, review period or service level')
    duration = review + (int(lead) if lead is not None else 0)
    if duration > paths.shape[1]:
        result['quantilePolicy'] = {'status': 'horizon_too_short', 'requiredDays': duration,
            'availableDays': paths.shape[1], 'reason': 'Extend the forecast horizon before applying this lead-time policy'}
        return result
    demand, supported = finite_quantile(paths[:, :duration].sum(axis=1), level)
    stock = existing.get('CurrentStock')
    policy = {'status': 'lead_time_quantile' if lead is not None else 'weekly_review_missing_supplier_lead_time',
        'serviceLevelTarget': level, 'leadTimeDays': lead, 'reviewPeriodDays': review,
        'demandDays': duration, 'targetDemand': demand, 'finiteSampleSupported': supported,
        'coverageGuarantee': False, 'periodDemand': path_summary(paths[:, :duration]),
        'manualReviewRequired': not supported or lead is None,
        'missingConstraints': [key for key in ('leadTimeDays', 'packSize', 'minimumOrderQuantity', 'shelfLifeDays', 'supplierDeliveryWeekdays') if key not in config]}
    schedule = config.get('supplierDeliveryWeekdays')
    if schedule is not None:
        if not schedule or any(isinstance(day, bool) or int(day) != day or not 0 <= day <= 6 for day in schedule):
            raise ValueError('Supplier delivery weekdays must use Monday=0 through Sunday=6')
        policy['supplierDeliveryWeekdays'] = schedule
        policy['manualReviewRequired'] = True
        policy['scheduleNote'] = 'Confirm order cutoffs and the next supplier delivery date before ordering.'
    if stock is None or not existing.get('HasInventoryData'):
        result['quantilePolicy'] = policy
        return result
    target = max(demand + float(existing.get('SafetyStock') or 0), float(existing.get('ReorderPoint') or 0))
    purchase = max(0., target - float(stock))
    shelf = config.get('shelfLifeDays')
    if shelf is not None:
        if int(shelf) != shelf or shelf < 1 or shelf > paths.shape[1]:
            raise ValueError('Shelf-life cap requires a positive whole-day value within the forecast horizon')
        cap = max(0., float(np.median(paths[:, :int(shelf)].sum(axis=1))) - float(stock))
        purchase = min(purchase, cap)
        policy['shelfLifePurchaseCap'] = cap
    pack = float(config.get('packSize', 1))
    minimum = float(config.get('minimumOrderQuantity', 0))
    if not np.isfinite(pack) or pack <= 0 or not np.isfinite(minimum) or minimum < 0:
        raise ValueError('Positive pack size and nonnegative minimum order quantity are required')
    purchase = math.ceil(max(purchase, minimum) / pack) * pack if purchase > 0 else 0
    if shelf is not None and purchase > policy['shelfLifePurchaseCap']:
        policy['manualReviewRequired'] = True
        policy['constraintConflict'] = 'Pack size or minimum order exceeds the shelf-life cap'
        purchase = 0
    result.update(RecommendedPurchase=purchase, BuyOnNextRun='Yes' if purchase else 'No',
        ProjectedRemaining=float(stock) + purchase - float(existing['ForecastTotal']),
        Recommendation=f'Review purchase of {purchase:g} {existing["Unit"]} for a {level:.0%} demand-quantile target. Supplier and shelf-life constraints require review.' if purchase else 'No purchase under the selected quantile policy; review flagged constraints.')
    stockout = existing.get('StockoutDay')
    result['Priority'] = ('Critical' if stockout is not None and stockout <= 2 else
        'High' if stockout is not None and stockout <= 4 else 'Medium' if stockout is not None else 'Low') if purchase else 'Healthy'
    if policy.get('constraintConflict'):
        result['Priority'] = 'Review Required'
    if lead is not None:
        result['ReorderPoint'] = target
    result['quantilePolicy'] = policy
    return result
