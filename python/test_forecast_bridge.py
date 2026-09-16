import unittest
import pandas as pd
from forecast_bridge import conversion, seven_calendar_days, match_material
from InventoryRecommendation import build_report


class ForecastBridgeTests(unittest.TestCase):
    def test_calendar_week_includes_weekend_and_crosses_month(self):
        dates = seven_calendar_days('2026-01-29')
        self.assertEqual(len(dates), 7)
        self.assertEqual(str(dates[-1].date()), '2026-02-04')
        self.assertEqual(sum(dates.dayofweek >= 5), 2)

    def test_unit_conversion_and_incompatible_units(self):
        self.assertEqual(conversion('kg', 'G'), 1000)
        self.assertEqual(conversion('L', 'ML'), 1000)
        with self.assertRaises(ValueError):
            conversion('kg', 'PCS')

    def test_matching_uses_sku_and_rejects_ambiguous_names(self):
        rows = pd.DataFrame([{'item_code': 'RM-ONE', 'raw_material': 'Milk'}])
        self.assertEqual(match_material(rows, [{'id': 'one', 'sku': 'RM-ONE', 'name': 'Fresh Milk'}])['id'], 'one')
        with self.assertRaises(ValueError):
            match_material(rows, [{'id': str(i), 'sku': str(i), 'name': 'Milk'} for i in range(2)])

    def test_recommendations_interpret_seven_calendar_days(self):
        forecast = pd.DataFrame({'Date': seven_calendar_days('2026-09-07'), 'RawMaterial': ['Milk'] * 7,
            'Unit': ['ML'] * 7, 'Forecast': [10, 10, 10, 10, 10, 0, 0],
            'MAE': [1] * 7, 'RMSE': [1] * 7, 'MAPE': [10] * 7, 'SMAPE': [10] * 7})
        inventory = pd.DataFrame([{'Product': 'Milk', 'CurrentStock': 15, 'SafetyStock': 5, 'LeadTime': 2}])
        report = build_report(forecast, inventory).iloc[0]
        self.assertEqual(report['Forecast7Days'], 50)
        self.assertEqual(report['StockoutDay'], 2)
        self.assertEqual(report['RecommendedPurchase'], 40)
        self.assertEqual(report['Priority'], 'Critical')


if __name__ == '__main__':
    unittest.main()
