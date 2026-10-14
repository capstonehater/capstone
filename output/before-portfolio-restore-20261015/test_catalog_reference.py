import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd

import SARIMA
from catalog_reference import inventory_reference, validate_history
from InventoryRecommendation import build_report


class CatalogReferenceTests(unittest.TestCase):
    def setUp(self):
        self.catalog = pd.DataFrame([
            {"record_type": "RAW_MATERIAL", "sku": "RM-MILK", "name": "Milk",
             "unit_code": "ml", "reorder_point": 50},
            {"record_type": "PRODUCT_VARIANT", "sku": "LATTE-ICED", "name": "Iced",
             "product_name": "Latte", "variant_name": "Iced"},
        ])
        self.history = pd.DataFrame([{"item_code": "RM-MILK", "raw_material": "Milk",
            "unit": "ml", "product_sku": "LATTE-ICED", "product": "Latte", "variant": "Iced"}])
        self.forecast = pd.DataFrame({"RawMaterial": "Milk", "Unit": "ml",
            "Date": pd.date_range("2026-09-01", periods=7), "Forecast": 10.,
            "MAE": 1., "RMSE": 1., "MAPE": 10., "SMAPE": 10.})

    def test_catalog_is_not_current_stock(self):
        reference = inventory_reference(self.catalog)
        self.assertTrue(reference.CurrentStock.isna().all())
        self.assertEqual(reference.CatalogReorderPoint.iloc[0], 50)
        report = build_report(self.forecast, reference).iloc[0]
        self.assertFalse(report.HasInventoryData)
        self.assertTrue(pd.isna(report.RecommendedPurchase))
        self.assertTrue(pd.isna(report.CurrentStock))
        self.assertEqual(report.Priority, "No Data")
        self.assertEqual(report.BuyOnNextRun, "No Data")

    def test_catalog_target_and_live_stock_drive_restocking(self):
        reference = inventory_reference(self.catalog)
        reference["CurrentStock"] = 15.
        report = build_report(self.forecast, reference).iloc[0]
        self.assertEqual(report.ReorderPoint, 50)
        self.assertEqual(report.RecommendedPurchase, 105)  # 70 demand + 50 target - 15 stock
        self.assertEqual(report.ProjectedRemaining, 50)

    def test_mismatched_material_unit_or_product_is_rejected(self):
        validate_history(self.history, self.catalog)
        for column, value in [("unit", "g"), ("item_code", "OLD-SKU"),
                              ("product_sku", "OLD-PRODUCT"), ("product", "Old Latte"),
                              ("variant", "Hot")]:
            with self.subTest(column=column):
                invalid = self.history.copy()
                invalid[column] = value
                with self.assertRaises(ValueError):
                    validate_history(invalid, self.catalog)

    def test_sparse_material_retains_edited_sarima_material_date_range(self):
        daily = pd.DataFrame({"raw_material": ["Other", "Milk", "Other"],
            "unit": ["ml"] * 3, "transaction_date": pd.to_datetime([
                "2026-01-01", "2026-01-02", "2026-01-03"]), "qty": [1., 2., 3.]})
        with patch.dict(SARIMA.CONFIG, BUSINESS_DAYS_ONLY=False):
            result = SARIMA.build_daily_series(daily, "Milk", "ml", pd.Series(dtype=int))
        self.assertEqual(result.qty.tolist(), [2.])


if __name__ == "__main__":
    unittest.main()
