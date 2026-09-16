from pathlib import Path

import numpy as np
import pandas as pd


DATA_DIR = Path(__file__).resolve().parent
FORECAST_FILE = DATA_DIR / "forecast_database.csv"
INVENTORY_FILE = DATA_DIR / "current_inventory.csv"
REPORT_FILE = DATA_DIR / "inventory_recommendation.csv"
ALL_RESTOCK_FILE = DATA_DIR / "raw_material_restocking.csv"
FORECAST_COLUMNS = [
    "Product",
    "RawMaterial",
    "Unit",
    "Date",
    "Forecast",
    "RawMaterialUsage",
    "Lower95",
    "Upper95",
    "Order",
    "SeasonalOrder",
    "AIC",
    "BIC",
    "MAE",
    "RMSE",
    "MAPE",
    "SMAPE",
]

def load_inputs():
    """Load and validate the SARIMA forecast and raw-material inventory files."""
    forecast = pd.read_csv(FORECAST_FILE)
    if "RawMaterial" not in forecast.columns:
        forecast = pd.read_csv(FORECAST_FILE, header=None, names=FORECAST_COLUMNS)
    inventory = pd.read_csv(INVENTORY_FILE)

    required_forecast = ["Product", "RawMaterial", "Unit", "Date", "Forecast"]
    required_inventory = ["Product", "CurrentStock", "LeadTime", "SafetyStock"]
    for column in required_forecast:
        if column not in forecast.columns:
            raise ValueError(f"Missing column in forecast_database.csv: {column}")
    for column in required_inventory:
        if column not in inventory.columns:
            raise ValueError(f"Missing column in current_inventory.csv: {column}")

    forecast["Date"] = pd.to_datetime(forecast["Date"], errors="raise")
    forecast["Forecast"] = pd.to_numeric(forecast["Forecast"], errors="coerce").fillna(0)
    for column in ["CurrentStock", "LeadTime", "SafetyStock"]:
        inventory[column] = pd.to_numeric(inventory[column], errors="raise")
    counts = forecast.groupby(["RawMaterial", "Unit"])["Date"].nunique()
    if (counts != 7).any() or forecast.duplicated(["RawMaterial", "Unit", "Date"]).any():
        raise ValueError("Each material requires exactly seven distinct forecast dates; regenerate the incomplete CSV.")
    if inventory["Product"].duplicated().any():
        raise ValueError("Inventory contains duplicate material names")
    return forecast, inventory


def create_forecast_summary(forecast):
    """Aggregate the seven forecast days by raw material and unit."""
    metric_columns = {
        "MAE": ("MAE", "first"),
        "RMSE": ("RMSE", "first"),
        "MAPE": ("MAPE", "first"),
        "SMAPE": ("SMAPE", "first"),
    }
    aggregation = {
        "Forecast7Days": ("Forecast", "sum"),
        "DailyDemand": ("Forecast", "mean"),
    }
    aggregation.update(metric_columns)
    return (
        forecast.groupby(["RawMaterial", "Unit"], as_index=False)
        .agg(**aggregation)
        .rename(columns={"RawMaterial": "Product"})
    )


def simulate_inventory(product, current_stock, daily_forecast):
    """Return the first forecast day on which stock reaches zero."""
    product_forecast = daily_forecast[daily_forecast["RawMaterial"] == product]
    remaining = current_stock
    for day, (_, row) in enumerate(product_forecast.sort_values("Date").iterrows(), 1):
        remaining -= row["Forecast"]
        if remaining <= 0:
            return day
    return np.nan


def build_report(forecast, inventory):
    forecast_summary = create_forecast_summary(forecast)
    inventory_data = forecast_summary.merge(inventory, on="Product", how="left")
    inventory_data["HasInventoryData"] = inventory_data["CurrentStock"].notna()
    inventory_data[["CurrentStock", "SafetyStock", "LeadTime"]] = (
        inventory_data[["CurrentStock", "SafetyStock", "LeadTime"]].fillna(0)
    )

    inventory_data["DailyDemand"] = (inventory_data["Forecast7Days"] / 7).round(2)
    inventory_data["LeadTimeDemand"] = (
        inventory_data["DailyDemand"] * inventory_data["LeadTime"]
    ).round(2)
    inventory_data["ReorderPoint"] = (
        inventory_data["LeadTimeDemand"] + inventory_data["SafetyStock"]
    ).round(2)
    inventory_data["DaysRemaining"] = np.where(
        inventory_data["DailyDemand"] > 0,
        inventory_data["CurrentStock"] / inventory_data["DailyDemand"],
        np.inf,
    ).round(1)
    inventory_data["StockoutDay"] = [
        simulate_inventory(product, stock, forecast)
        for product, stock in zip(
            inventory_data["Product"], inventory_data["CurrentStock"]
        )
    ]
    inventory_data["RecommendedPurchase"] = np.ceil(
        np.maximum(
            0,
            inventory_data["Forecast7Days"]
            + inventory_data["SafetyStock"]
            - inventory_data["CurrentStock"],
        )
    ).astype(int)
    inventory_data["BuyOnNextRun"] = np.where(
        inventory_data["RecommendedPurchase"] > 0, "Yes", "No"
    )
    inventory_data["ProjectedRemaining"] = (
        inventory_data["CurrentStock"]
        + inventory_data["RecommendedPurchase"]
        - inventory_data["Forecast7Days"]
    ).round(2)

    def get_priority(row):
        if not row["HasInventoryData"]:
            return "No Data"
        if row["RecommendedPurchase"] == 0:
            return "Healthy"
        stockout_day = row["StockoutDay"]
        if pd.isna(stockout_day) or stockout_day > 7:
            return "Low"
        if stockout_day <= 2:
            return "Critical"
        if stockout_day <= 4:
            return "High"
        return "Medium"

    inventory_data["Priority"] = inventory_data.apply(get_priority, axis=1)
    inventory_data["Recommendation"] = inventory_data.apply(
        lambda row: (
            "No inventory record found for this product."
            if not row["HasInventoryData"]
            else "Inventory is sufficient."
            if row["RecommendedPurchase"] == 0
            else f"Restock {row['RecommendedPurchase']} {row['Unit']} on the next "
            f"stock run; current stock reaches zero by forecast day "
            f"{int(row['StockoutDay'])}."
            if not pd.isna(row["StockoutDay"])
            else f"Restock {row['RecommendedPurchase']} {row['Unit']} on the next "
            "stock run to cover the forecast and safety stock."
        ),
        axis=1,
    )
    priority_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Healthy": 4, "No Data": 5}
    return inventory_data.sort_values(
        ["Priority", "StockoutDay", "RecommendedPurchase"],
        key=lambda column: column.map(priority_order).fillna(column)
        if column.name == "Priority"
        else column,
        ascending=[True, True, False],
    ).reset_index(drop=True)


def lookup_product(report):
    """Interactively display forecast and restocking data for a product."""
    while True:
        try:
            search_term = input(
                "\nEnter a product/raw material name, or type EXIT: "
            ).strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return

        if search_term.upper() == "EXIT":
            return
        if not search_term:
            print("Please enter a product name.")
            continue

        matches = report[
            report["Product"].str.contains(search_term, case=False, na=False)
        ]
        if matches.empty:
            print(f"No product found matching '{search_term}'.")
            continue

        if len(matches) > 1:
            print("\nMatching products:")
            print(matches[["Product", "Unit"]].to_string(index=False))
            print("Enter a more specific name to view one product.")
            continue

        product = matches.iloc[0]
        print("\n" + "=" * 70)
        print(f"PRODUCT DETAILS: {product['Product']}")
        print("=" * 70)
        print(f"Unit                 : {product['Unit']}")
        print(f"Current stock        : {product['CurrentStock']:.2f}")
        print(f"Seven-day forecast   : {product['Forecast7Days']:.2f}")
        print(f"Average daily demand : {product['DailyDemand']:.2f}")
        print(f"Safety stock         : {product['SafetyStock']:.2f}")
        print(f"Days remaining       : {product['DaysRemaining']:.1f}")
        stockout_day = product["StockoutDay"]
        print(
            "Stockout day        : "
            + ("No stockout in forecast" if pd.isna(stockout_day) else f"Day {int(stockout_day)}")
        )
        print(f"Priority             : {product['Priority']}")
        print(f"Restock quantity     : {product['RecommendedPurchase']} {product['Unit']}")
        print(f"Buy on next run     : {product['BuyOnNextRun']}")
        print(f"Recommendation       : {product['Recommendation']}")
        print("=" * 70)


def main():
    forecast, inventory = load_inputs()
    report = build_report(forecast, inventory)
    report.to_csv(REPORT_FILE, index=False)

    all_restock = report.copy()
    all_restock.insert(0, "RawMaterialRank", range(1, len(all_restock) + 1))
    all_restock["RestockQuantity"] = all_restock["RecommendedPurchase"]
    all_restock["RestockExplanation"] = all_restock["Recommendation"]
    all_restock = all_restock[
        [
            "RawMaterialRank",
            "Product",
            "Unit",
            "RestockQuantity",
            "CurrentStock",
            "Forecast7Days",
            "SafetyStock",
            "DaysRemaining",
            "StockoutDay",
            "HasInventoryData",
            "BuyOnNextRun",
            "Priority",
            "RestockExplanation",
        ]
    ]
    all_restock.to_csv(ALL_RESTOCK_FILE, index=False)

    top10 = report[
        report["HasInventoryData"] & (report["RecommendedPurchase"] > 0)
    ].copy()
    top10.insert(0, "RestockRank", range(1, len(top10) + 1))
    top10["RestockQuantity"] = top10["RecommendedPurchase"]
    top10["RestockExplanation"] = top10["Recommendation"]
    top10 = top10[
        [
            "RestockRank",
            "Product",
            "Unit",
            "RestockQuantity",
            "CurrentStock",
            "Forecast7Days",
            "SafetyStock",
            "DaysRemaining",
            "StockoutDay",
            "Priority",
            "RestockExplanation",
        ]
    ].head(10)
    top10.to_csv(TOP10_FILE, index=False)

    print("=" * 70)
    print("SARIMA INVENTORY ANALYSIS COMPLETE")
    print("=" * 70)
    print(f"Forecast rows analyzed : {len(forecast)}")
    print(f"Raw materials analyzed : {len(report)}")
    print(f"Detailed report        : {REPORT_FILE.name}")
    print(f"All restocking needs    : {ALL_RESTOCK_FILE.name}")
    print(f"Top 10 product list    : {TOP10_FILE.name}")
    print("\nTOP 10 PRODUCTS TO RESTOCK")
    print(
        top10[
            ["RestockRank", "Product", "Unit", "RestockQuantity", "Priority", "RestockExplanation"]
        ].to_string(index=False)
    )
    lookup_product(report)


if __name__ == "__main__":
    main()