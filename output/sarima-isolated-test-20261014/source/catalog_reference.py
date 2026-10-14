"""Catalog identities and reorder thresholds; stock remains a live measurement."""
from pathlib import Path

import numpy as np
import pandas as pd


CATALOG_FILE = Path(__file__).resolve().parent / "raw-materials-and-products.csv"


def load_catalog(path=None):
    catalog = pd.read_csv(path or CATALOG_FILE, encoding="utf-8-sig", keep_default_na=False)
    required = {"record_type", "sku", "name", "product_name", "variant_name",
                "unit_code", "reorder_point", "is_active"}
    missing = required - set(catalog)
    if missing:
        raise ValueError(f"Catalog missing columns: {sorted(missing)}")
    catalog = catalog[catalog.is_active.astype(str).str.lower().eq("true")].copy()
    if catalog.sku.eq("").any() or catalog.sku.duplicated().any():
        raise ValueError("Active catalog SKUs must be nonempty and unique")
    return catalog


def inventory_reference(catalog):
    materials = catalog[catalog.record_type.eq("RAW_MATERIAL")].copy()
    if materials.empty or materials.name.duplicated().any():
        raise ValueError("Catalog requires raw materials with unique names")
    points = pd.to_numeric(materials.reorder_point, errors="raise")
    if not np.isfinite(points).all() or points.lt(0).any():
        raise ValueError("Catalog reorder points must be finite and nonnegative")
    reference = materials[["sku", "name", "unit_code"]].rename(
        columns={"sku": "ItemCode", "name": "Product", "unit_code": "Unit"})
    reference["CatalogReorderPoint"] = points
    # These fields are absent from the catalog. Unknown stock is never zero stock.
    reference["CurrentStock"] = np.nan
    reference["LeadTime"] = 0.0
    reference["SafetyStock"] = 0.0
    return reference.reset_index(drop=True)


def validate_history(history, catalog):
    materials = inventory_reference(catalog).set_index("ItemCode")
    unknown = set(history.item_code) - set(materials.index)
    if unknown:
        raise ValueError(f"History contains material SKUs outside the active catalog: {sorted(unknown)}")
    names = history.item_code.map(materials.Product)
    units = history.item_code.map(materials.Unit)
    if not history.raw_material.eq(names).all() or not history.unit.eq(units).all():
        raise ValueError("Historical material names and units must match catalog SKUs")
    if "product_sku" in history:
        variants = catalog[catalog.record_type.eq("PRODUCT_VARIANT")].set_index("sku")
        unknown = set(history.product_sku) - set(variants.index)
        if unknown:
            raise ValueError(f"History contains product SKUs outside the active catalog: {sorted(unknown)}")
        if not history["product"].eq(history.product_sku.map(variants.product_name)).all():
            raise ValueError("Historical product names must match catalog variant SKUs")
        if "variant" in history and not history.variant.eq(history.product_sku.map(variants.variant_name)).all():
            raise ValueError("Historical variants must match catalog variant SKUs")
