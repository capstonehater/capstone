# Seven-day SARIMA results

**Forecast period: October 14–20, 2026.**

Completed: 79 SARIMA fits, 0 constant baselines, 1 exclusions. All 80 active materials are listed.

This is a direct SARIMA/SARIMAX experiment in a separate Python virtual environment with frozen source code. It does not apply the app portfolio’s simpler-method promotion routing. The database and saved app forecasts were not modified.

Inputs: 2024–2026 synthetic CSV history plus a read-only completed POS snapshot through October 12. Typical history contains 1,016 days: 645 CSV, 368 recorded POS, and 3 causally estimated gap days. The model may select a recent fitting window.

POS unit provenance: 8,969 material/day totals lack saved source-unit codes. They use catalog-unit assumptions, matching the current bridge fallback; those quantities are not independently verified unit snapshots.

CV MAPE is positive-day rolling **selection error**, not accuracy on the future week or an independent final holdout. Four chronological windows use the forecast distance including the unobserved history gap. For these fits the validation period is September 11–October 12, using recorded POS targets; estimated gap targets are excluded. Undefined MAPE is shown as —, not zero.

Median defined CV MAPE: **94.12%** across 76 materials. Values vary by material and positive-day sample size; this does not establish improved accuracy versus previous runs on different dates.

Quantities are ingredient usage in the displayed live inventory unit, rounded to two decimal places. Exact values and uncalibrated model-based daily 95% bounds are in results.json; these bounds are not weekly-total intervals or measured coverage.

## Per-material summary

| Material | Unit | 7-day forecast | CV MAPE (% error) | CV MAE | Positive POS days in CV | Available / fitting days | Status |
|---|---|---:|---:|---:|---:|---:|---|
| Alaska Classic Evaporated Filled Milk 370ml | ml | 0.28 | 100.00 | 3.13 | 2 | 1016 / 1016 | SARIMA |
| Alaska Condensed Milk 390g | g | 183.76 | 27.08 | 18.80 | 19 | 1016 / 182 | SARIMA |
| Arla Mozzarella Cheese 200g | g | 598.59 | 34.83 | 70.89 | 16 | 1016 / 182 | SARIMA |
| Bounty Fresh Large Eggs 12s | pcs | 6.19 | 85.34 | 0.78 | 24 | 1016 / 182 | SARIMA |
| Butterfly Pea Flower Dried 100g | g | 0.07 | 94.42 | 0.32 | 5 | 1016 / 1016 | SARIMA |
| Campfire Mini Marshmallows 300g | g | 3.53 | 98.29 | 4.89 | 2 | 1016 / 182 | SARIMA |
| Century Tuna Flakes in Oil 180g | g | 22.87 | 73.71 | 25.78 | 4 | 1016 / 1016 | SARIMA |
| ChaTraMue Original Thai Tea Mix 400g | g | 0.28 | 100.00 | 1.51 | 2 | 1016 / 1016 | SARIMA |
| Datu Puti Vinegar 1L | ml | 2.16 | 95.47 | 1.50 | 2 | 1016 / 1016 | SARIMA |
| Del Monte Peach Halves 825g | g | 2.43 | 99.95 | 2.30 | 1 | 1016 / 1016 | SARIMA |
| Del Monte Tomato Sauce 1kg | g | 261.25 | 62.39 | 83.57 | 22 | 1016 / 1016 | SARIMA |
| Doña Maria Jasponica Rice 5kg | g | 581.31 | 28.84 | 77.56 | 16 | 1016 / 365 | SARIMA |
| Eden Original Cheese 180g | g | 206.03 | 34.60 | 52.76 | 16 | 1016 / 365 | SARIMA |
| Farm Frites Frozen French Fries 1kg | g | 14.65 | 96.92 | 17.40 | 3 | 1016 / 1016 | SARIMA |
| Fidel Iodized Salt 1kg | g | 6.96 | 77.21 | 1.63 | 3 | 1016 / 1016 | SARIMA |
| Filippo Berio Basil Pesto 190g | g | 12.26 | 95.74 | 12.33 | 5 | 1016 / 365 | SARIMA |
| Food Grade PET Sauce Bottle 150ml | pcs | 0.00 | — | 0.00 | 0 | 1016 / 1016 | SARIMA |
| Fresh Garlic 1kg | g | 63.43 | 61.41 | 18.08 | 23 | 1016 / 1016 | SARIMA |
| Fresh Iceberg Lettuce 1kg | g | 0.45 | 100.00 | 2.86 | 3 | 1016 / 1016 | SARIMA |
| Fresh Lakatan Banana 1kg | g | 1.67 | 99.96 | 2.76 | 1 | 1016 / 1016 | SARIMA |
| Fresh Medium Shrimp 1kg | g | 1.31 | 99.99 | 2.66 | 1 | 1016 / 182 | SARIMA |
| Fresh Philippine Mango 1kg | g | 22.45 | 96.02 | 42.61 | 11 | 1016 / 365 | SARIMA |
| Fresh Philippine Red Chili Peppers 1kg | g | 0.00 | — | 0.00 | 0 | 1016 / 1016 | SARIMA |
| Fresh Pizza Dough 250g | g | 1,100.97 | 36.15 | 162.24 | 16 | 1016 / 365 | SARIMA |
| Fresh Red Onion 1kg | g | 168.90 | 53.23 | 34.18 | 18 | 1016 / 1016 | SARIMA |
| Fresh Strawberries 500g | g | 34.86 | 88.81 | 39.83 | 12 | 1016 / 1016 | SARIMA |
| Golden Fiesta Canola Oil 1L | ml | 212.01 | 100.00 | 11.20 | 2 | 1016 / 1016 | SARIMA |
| Greenware 12oz Double Wall Paper Cup | pcs | 1.96 | 100.00 | 0.10 | 2 | 1016 / 1016 | SARIMA |
| Greenware 12oz Sip Hole Lid | pcs | 1.96 | 100.00 | 0.10 | 2 | 1016 / 1016 | SARIMA |
| Greenware 22oz Cold Drink Cup | pcs | 1.97 | 100.00 | 0.10 | 1 | 1016 / 1016 | SARIMA |
| Greenware 22oz Dome Lid | pcs | 1.97 | 100.00 | 0.10 | 1 | 1016 / 1016 | SARIMA |
| Greenware Paper Drinking Straw 100s | pcs | 1.97 | 100.00 | 0.10 | 1 | 1016 / 1016 | SARIMA |
| Greenware Sugarcane Bagasse Bento Box | pcs | 20.99 | 100.00 | 1.40 | 3 | 1016 / 1016 | SARIMA |
| Hershey's Chocolate Syrup 623g | g | 204.26 | 40.45 | 18.69 | 21 | 1016 / 182 | SARIMA |
| Huy Fong Sriracha Hot Chili Sauce 481g | g | 8.97 | 73.17 | 10.13 | 13 | 1016 / 1016 | SARIMA |
| Kirkland Signature Macadamia Nuts 680g | g | 14.75 | 74.53 | 9.40 | 12 | 1016 / 1016 | SARIMA |
| Knorr Salted Egg Powder 500g | g | 4.39 | 98.00 | 10.35 | 7 | 1016 / 1016 | SARIMA |
| Kraft Grated Parmesan Cheese 85g | g | 248.33 | 82.97 | 31.47 | 15 | 1016 / 1016 | SARIMA |
| Lee Kum Kee Korean BBQ Sauce 240g | g | 0.89 | 99.51 | 1.60 | 1 | 1016 / 1016 | SARIMA |
| Lipton Yellow Label Black Tea Bags 100s | pcs | 0.48 | 89.92 | 0.22 | 3 | 1016 / 1016 | SARIMA |
| Lotus Biscoff Spread 400g | g | 46.09 | 68.73 | 9.71 | 9 | 1016 / 1016 | SARIMA |
| Magnolia Chicken Wings 1kg | g | 2,240.44 | 59.03 | 316.24 | 17 | 1016 / 182 | SARIMA |
| Magnolia Cream Cheese 225g | g | 2.60 | 97.91 | 2.19 | 3 | 1016 / 182 | SARIMA |
| Magnolia Fresh Milk 1L | ml | 4,701.53 | 107.52 | 590.33 | 29 | 1016 / 1016 | SARIMA |
| Magnolia Gold Butter Salted 225g | g | 138.87 | 33.42 | 13.32 | 21 | 1016 / 182 | SARIMA |
| Maya All Purpose Flour 2kg | g | 706.23 | 74.48 | 70.31 | 24 | 1016 / 182 | SARIMA |
| Maya Japanese Bread Crumbs 200g | g | 142.18 | 44.02 | 21.49 | 15 | 1016 / 365 | SARIMA |
| McCormick Ground Black Pepper 80g | g | 5.74 | 100.00 | 0.42 | 2 | 1016 / 1016 | SARIMA |
| Milktea Powder | g | — | — | — | — | 0 / — | failed |
| MILO Chocolate Malt Powder 300g | g | 123.42 | 46.60 | 27.26 | 22 | 1016 / 365 | SARIMA |
| Mission Soft Flour Tortillas 10s | pcs | 0.00 | 100.00 | 0.19 | 3 | 1016 / 1016 | SARIMA |
| MONIN Caramel Syrup 700ml | ml | 143.78 | 22.87 | 11.40 | 22 | 1016 / 182 | SARIMA |
| MONIN French Vanilla Syrup 700ml | ml | 15.00 | 85.78 | 10.73 | 10 | 1016 / 365 | SARIMA |
| MONIN Hazelnut Syrup 700ml | ml | 14.68 | 90.56 | 8.78 | 8 | 1016 / 365 | SARIMA |
| MONIN Mango Syrup 700ml | ml | 1.29 | 93.83 | 3.42 | 3 | 1016 / 1016 | SARIMA |
| MONIN Passion Fruit Syrup 700ml | ml | 7.70 | 95.71 | 9.23 | 9 | 1016 / 1016 | SARIMA |
| MONIN Peppermint Syrup 700ml | ml | 2.96 | 95.24 | 3.62 | 5 | 1016 / 365 | SARIMA |
| MONIN Strawberry Syrup 700ml | ml | 6.45 | 92.35 | 5.00 | 6 | 1016 / 1016 | SARIMA |
| MONIN White Chocolate Sauce 500ml | ml | 1.73 | 98.47 | 1.76 | 2 | 1016 / 182 | SARIMA |
| Monterey Beef Sirloin 1kg | g | 150.27 | 72.75 | 78.03 | 14 | 1016 / 182 | SARIMA |
| Nestlé All Purpose Cream 250ml | ml | 337.25 | 53.07 | 131.03 | 21 | 1016 / 365 | SARIMA |
| Oatside Barista Blend Oat Milk 1L | ml | 0.00 | — | 0.00 | 0 | 1016 / 1016 | SARIMA |
| Oreo Original Cookies 133g | g | 0.00 | 100.00 | 1.41 | 1 | 1016 / 1016 | SARIMA |
| Pampanga’s Best Pork Tocino 450g | g | 0.00 | 98.01 | 30.32 | 3 | 1016 / 1016 | SARIMA |
| Pampanga’s Best Skinless Longganisa 450g | g | 0.52 | 100.00 | 5.68 | 1 | 1016 / 1016 | SARIMA |
| Pure Ice Food Grade Ice 5kg | g | 345.24 | 100.00 | 18.00 | 1 | 1016 / 1016 | SARIMA |
| Purefoods Pepperoni 250g | g | 77.70 | 76.80 | 28.60 | 9 | 1016 / 1016 | SARIMA |
| Real Lemon Lemon Juice 250ml | ml | 256.86 | 34.26 | 34.66 | 21 | 1016 / 365 | SARIMA |
| San Remo Spaghetti Pasta 500g | g | 1,228.07 | 71.18 | 190.58 | 11 | 1016 / 1016 | SARIMA |
| Sarangani Bay Boneless Bangus 450g | g | 59.56 | 95.62 | 54.52 | 6 | 1016 / 1016 | SARIMA |
| Soy Taho with Arnibal 1kg | g | 19.79 | 96.36 | 23.57 | 6 | 1016 / 365 | SARIMA |
| Spanish Sardines in Olive Oil 220g | g | 11.51 | 87.94 | 38.69 | 4 | 1016 / 1016 | SARIMA |
| TOP Creamery Atok Benguet Arabica Coffee Beans Premium Grade 1kg | g | 440.67 | 162.79 | 63.64 | 29 | 1016 / 1016 | SARIMA |
| TOP Creamery Milk Tea Series Matcha Powder 500g | g | 110.64 | 36.86 | 13.61 | 16 | 1016 / 182 | SARIMA |
| TOP Creamery Pre-Cut Tissue Napkins 100pcs | pcs | 31.28 | 100.00 | 1.60 | 3 | 1016 / 1016 | SARIMA |
| Tostitos Restaurant Style Tortilla Chips 283g | g | 173.82 | 66.17 | 71.65 | 11 | 1016 / 182 | SARIMA |
| Twinings Chai Tea Bags 20s | pcs | 0.00 | 100.00 | 0.25 | 3 | 1016 / 1016 | SARIMA |
| Victorias Refined Sugar 1kg | g | 286.71 | 64.06 | 29.21 | 28 | 1016 / 365 | SARIMA |
| Wilkins Pure Bottled Water 500ml | pcs | 0.74 | 87.87 | 0.24 | 4 | 1016 / 365 | SARIMA |
| Wilkins Purified Water 6L | ml | 514.24 | 100.00 | 26.75 | 3 | 1016 / 1016 | SARIMA |

## Daily predictions

### Alaska Classic Evaporated Filled Milk 370ml (ml)

Selected configuration: order [2, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.07 |
| 2026-10-15 | 0.11 |
| 2026-10-16 | 0.10 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Alaska Condensed Milk 390g (g)

Selected configuration: order [1, 0, 0], seasonal order [1, 0, 0, 7], raw transform, level features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 26.80 |
| 2026-10-15 | 27.48 |
| 2026-10-16 | 27.66 |
| 2026-10-17 | 24.94 |
| 2026-10-18 | 24.94 |
| 2026-10-19 | 24.94 |
| 2026-10-20 | 27.01 |

### Arla Mozzarella Cheese 200g (g)

Selected configuration: order [1, 0, 0], seasonal order [1, 0, 0, 7], raw transform, level features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 85.24 |
| 2026-10-15 | 85.53 |
| 2026-10-16 | 85.33 |
| 2026-10-17 | 85.75 |
| 2026-10-18 | 85.75 |
| 2026-10-19 | 85.75 |
| 2026-10-20 | 85.23 |

### Bounty Fresh Large Eggs 12s (pcs)

Selected configuration: order [1, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday_calendar features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.95 |
| 2026-10-15 | 0.33 |
| 2026-10-16 | 0.72 |
| 2026-10-17 | 1.34 |
| 2026-10-18 | 1.39 |
| 2026-10-19 | 0.63 |
| 2026-10-20 | 0.84 |

### Butterfly Pea Flower Dried 100g (g)

Selected configuration: order [2, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.03 |
| 2026-10-15 | 0.02 |
| 2026-10-16 | 0.02 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Campfire Mini Marshmallows 300g (g)

Selected configuration: order [2, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday_calendar features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.02 |
| 2026-10-15 | 0.52 |
| 2026-10-16 | 0.27 |
| 2026-10-17 | 0.65 |
| 2026-10-18 | 1.17 |
| 2026-10-19 | 0.19 |
| 2026-10-20 | 0.71 |

### Century Tuna Flakes in Oil 180g (g)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 9.89 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 12.99 |

### ChaTraMue Original Thai Tea Mix 400g (g)

Selected configuration: order [2, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.07 |
| 2026-10-15 | 0.12 |
| 2026-10-16 | 0.10 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Datu Puti Vinegar 1L (ml)

Selected configuration: order [0, 1, 1], seasonal order [1, 1, 1, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.06 |
| 2026-10-15 | 0.49 |
| 2026-10-16 | 0.33 |
| 2026-10-17 | 0.80 |
| 2026-10-18 | 0.37 |
| 2026-10-19 | 0.09 |
| 2026-10-20 | 0.02 |

### Del Monte Peach Halves 825g (g)

Selected configuration: order [2, 1, 1], seasonal order [1, 0, 1, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.36 |
| 2026-10-15 | 0.35 |
| 2026-10-16 | 0.29 |
| 2026-10-17 | 0.35 |
| 2026-10-18 | 0.39 |
| 2026-10-19 | 0.35 |
| 2026-10-20 | 0.34 |

### Del Monte Tomato Sauce 1kg (g)

Selected configuration: order [0, 1, 1], seasonal order [0, 0, 1, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 39.98 |
| 2026-10-15 | 37.85 |
| 2026-10-16 | 39.21 |
| 2026-10-17 | 29.00 |
| 2026-10-18 | 42.56 |
| 2026-10-19 | 35.48 |
| 2026-10-20 | 37.17 |

### Doña Maria Jasponica Rice 5kg (g)

Selected configuration: order [1, 0, 0], seasonal order [1, 0, 0, 7], raw transform, level features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 83.39 |
| 2026-10-15 | 83.18 |
| 2026-10-16 | 83.73 |
| 2026-10-17 | 82.48 |
| 2026-10-18 | 82.48 |
| 2026-10-19 | 82.48 |
| 2026-10-20 | 83.57 |

### Eden Original Cheese 180g (g)

Selected configuration: order [1, 0, 0], seasonal order [0, 0, 0, 7], raw transform, weekday features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 19.24 |
| 2026-10-15 | 19.64 |
| 2026-10-16 | 23.48 |
| 2026-10-17 | 52.01 |
| 2026-10-18 | 42.54 |
| 2026-10-19 | 25.38 |
| 2026-10-20 | 23.75 |

### Farm Frites Frozen French Fries 1kg (g)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 7.32 |
| 2026-10-15 | 7.32 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Fidel Iodized Salt 1kg (g)

Selected configuration: order [1, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.61 |
| 2026-10-15 | 0.83 |
| 2026-10-16 | 0.92 |
| 2026-10-17 | 1.23 |
| 2026-10-18 | 1.29 |
| 2026-10-19 | 1.03 |
| 2026-10-20 | 1.05 |

### Filippo Berio Basil Pesto 190g (g)

Selected configuration: order [1, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 1.63 |
| 2026-10-15 | 0.83 |
| 2026-10-16 | 2.11 |
| 2026-10-17 | 1.28 |
| 2026-10-18 | 2.38 |
| 2026-10-19 | 1.70 |
| 2026-10-20 | 2.33 |

### Food Grade PET Sauce Bottle 150ml (pcs)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Fresh Garlic 1kg (g)

Selected configuration: order [0, 1, 1], seasonal order [1, 1, 1, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 9.22 |
| 2026-10-15 | 7.75 |
| 2026-10-16 | 7.17 |
| 2026-10-17 | 14.15 |
| 2026-10-18 | 10.43 |
| 2026-10-19 | 6.40 |
| 2026-10-20 | 8.31 |

### Fresh Iceberg Lettuce 1kg (g)

Selected configuration: order [1, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.25 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.21 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Fresh Lakatan Banana 1kg (g)

Selected configuration: order [1, 1, 0], seasonal order [1, 1, 1, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.30 |
| 2026-10-15 | 0.17 |
| 2026-10-16 | 0.13 |
| 2026-10-17 | 0.88 |
| 2026-10-18 | 0.15 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.03 |

### Fresh Medium Shrimp 1kg (g)

Selected configuration: order [2, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday_calendar features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.02 |
| 2026-10-15 | 0.25 |
| 2026-10-16 | 0.33 |
| 2026-10-17 | 0.10 |
| 2026-10-18 | 0.20 |
| 2026-10-19 | 0.01 |
| 2026-10-20 | 0.40 |

### Fresh Philippine Mango 1kg (g)

Selected configuration: order [1, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 2.61 |
| 2026-10-15 | 2.62 |
| 2026-10-16 | 3.80 |
| 2026-10-17 | 5.07 |
| 2026-10-18 | 3.67 |
| 2026-10-19 | 1.25 |
| 2026-10-20 | 3.45 |

### Fresh Philippine Red Chili Peppers 1kg (g)

Selected configuration: order [0, 1, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Fresh Pizza Dough 250g (g)

Selected configuration: order [1, 0, 0], seasonal order [1, 0, 0, 7], raw transform, level features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 155.80 |
| 2026-10-15 | 158.19 |
| 2026-10-16 | 165.51 |
| 2026-10-17 | 152.66 |
| 2026-10-18 | 152.66 |
| 2026-10-19 | 152.66 |
| 2026-10-20 | 163.50 |

### Fresh Red Onion 1kg (g)

Selected configuration: order [2, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday_calendar features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 22.38 |
| 2026-10-15 | 24.82 |
| 2026-10-16 | 22.92 |
| 2026-10-17 | 33.64 |
| 2026-10-18 | 26.60 |
| 2026-10-19 | 19.94 |
| 2026-10-20 | 18.60 |

### Fresh Strawberries 500g (g)

Selected configuration: order [0, 1, 1], seasonal order [1, 1, 1, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 3.57 |
| 2026-10-15 | 4.18 |
| 2026-10-16 | 3.37 |
| 2026-10-17 | 7.96 |
| 2026-10-18 | 7.77 |
| 2026-10-19 | 4.69 |
| 2026-10-20 | 3.33 |

### Golden Fiesta Canola Oil 1L (ml)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 113.49 |
| 2026-10-18 | 98.52 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Greenware 12oz Double Wall Paper Cup (pcs)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.98 |
| 2026-10-19 | 0.98 |
| 2026-10-20 | 0.00 |

### Greenware 12oz Sip Hole Lid (pcs)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.98 |
| 2026-10-19 | 0.98 |
| 2026-10-20 | 0.00 |

### Greenware 22oz Cold Drink Cup (pcs)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 1.97 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Greenware 22oz Dome Lid (pcs)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 1.97 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Greenware Paper Drinking Straw 100s (pcs)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 1.97 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Greenware Sugarcane Bagasse Bento Box (pcs)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 7.60 |
| 2026-10-18 | 11.71 |
| 2026-10-19 | 1.68 |
| 2026-10-20 | 0.00 |

### Hershey's Chocolate Syrup 623g (g)

Selected configuration: order [1, 0, 0], seasonal order [0, 0, 0, 7], raw transform, weekday features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 21.47 |
| 2026-10-15 | 23.04 |
| 2026-10-16 | 37.88 |
| 2026-10-17 | 37.04 |
| 2026-10-18 | 36.42 |
| 2026-10-19 | 23.11 |
| 2026-10-20 | 25.31 |

### Huy Fong Sriracha Hot Chili Sauce 481g (g)

Selected configuration: order [2, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 2.14 |
| 2026-10-15 | 1.41 |
| 2026-10-16 | 1.47 |
| 2026-10-17 | 1.08 |
| 2026-10-18 | 1.00 |
| 2026-10-19 | 1.02 |
| 2026-10-20 | 0.86 |

### Kirkland Signature Macadamia Nuts 680g (g)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 9.85 |
| 2026-10-16 | 4.90 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Knorr Salted Egg Powder 500g (g)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 2.99 |
| 2026-10-16 | 1.41 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Kraft Grated Parmesan Cheese 85g (g)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 33.83 |
| 2026-10-15 | 13.89 |
| 2026-10-16 | 6.72 |
| 2026-10-17 | 182.12 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 11.77 |

### Lee Kum Kee Korean BBQ Sauce 240g (g)

Selected configuration: order [1, 1, 0], seasonal order [1, 1, 1, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.28 |
| 2026-10-15 | 0.14 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 0.10 |
| 2026-10-18 | 0.36 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Lipton Yellow Label Black Tea Bags 100s (pcs)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.13 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.35 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Lotus Biscoff Spread 400g (g)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 5.04 |
| 2026-10-15 | 7.26 |
| 2026-10-16 | 5.04 |
| 2026-10-17 | 17.38 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 11.39 |

### Magnolia Chicken Wings 1kg (g)

Selected configuration: order [2, 0, 0], seasonal order [0, 0, 0, 7], raw transform, weekday_calendar features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 278.40 |
| 2026-10-15 | 611.71 |
| 2026-10-16 | 112.63 |
| 2026-10-17 | 269.49 |
| 2026-10-18 | 601.84 |
| 2026-10-19 | 221.48 |
| 2026-10-20 | 144.89 |

### Magnolia Cream Cheese 225g (g)

Selected configuration: order [1, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.38 |
| 2026-10-15 | 0.34 |
| 2026-10-16 | 0.38 |
| 2026-10-17 | 0.38 |
| 2026-10-18 | 0.38 |
| 2026-10-19 | 0.38 |
| 2026-10-20 | 0.37 |

### Magnolia Fresh Milk 1L (ml)

Selected configuration: order [2, 1, 1], seasonal order [0, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 669.12 |
| 2026-10-15 | 677.92 |
| 2026-10-16 | 672.28 |
| 2026-10-17 | 670.62 |
| 2026-10-18 | 670.49 |
| 2026-10-19 | 670.54 |
| 2026-10-20 | 670.55 |

### Magnolia Gold Butter Salted 225g (g)

Selected configuration: order [2, 0, 0], seasonal order [0, 0, 0, 7], raw transform, weekday_calendar features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 13.38 |
| 2026-10-15 | 19.91 |
| 2026-10-16 | 13.47 |
| 2026-10-17 | 21.26 |
| 2026-10-18 | 33.97 |
| 2026-10-19 | 18.20 |
| 2026-10-20 | 18.68 |

### Maya All Purpose Flour 2kg (g)

Selected configuration: order [1, 0, 1], seasonal order [0, 0, 0, 7], raw transform, weekday_calendar features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 65.44 |
| 2026-10-15 | 99.24 |
| 2026-10-16 | 70.71 |
| 2026-10-17 | 108.90 |
| 2026-10-18 | 173.79 |
| 2026-10-19 | 95.84 |
| 2026-10-20 | 92.31 |

### Maya Japanese Bread Crumbs 200g (g)

Selected configuration: order [1, 0, 0], seasonal order [0, 0, 0, 7], raw transform, weekday features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 20.26 |
| 2026-10-15 | 24.63 |
| 2026-10-16 | 15.42 |
| 2026-10-17 | 23.45 |
| 2026-10-18 | 29.26 |
| 2026-10-19 | 13.76 |
| 2026-10-20 | 15.41 |

### McCormick Ground Black Pepper 80g (g)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 3.06 |
| 2026-10-18 | 2.69 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Milktea Powder (g)

No compatible CSV or completed POS usage history

### MILO Chocolate Malt Powder 300g (g)

Selected configuration: order [1, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 17.84 |
| 2026-10-15 | 17.67 |
| 2026-10-16 | 18.16 |
| 2026-10-17 | 16.05 |
| 2026-10-18 | 18.36 |
| 2026-10-19 | 17.76 |
| 2026-10-20 | 17.59 |

### Mission Soft Flour Tortillas 10s (pcs)

Selected configuration: order [0, 1, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### MONIN Caramel Syrup 700ml (ml)

Selected configuration: order [1, 0, 0], seasonal order [1, 0, 0, 7], raw transform, level features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 20.41 |
| 2026-10-15 | 22.48 |
| 2026-10-16 | 20.73 |
| 2026-10-17 | 19.10 |
| 2026-10-18 | 20.96 |
| 2026-10-19 | 19.10 |
| 2026-10-20 | 21.00 |

### MONIN French Vanilla Syrup 700ml (ml)

Selected configuration: order [1, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 1.61 |
| 2026-10-15 | 1.58 |
| 2026-10-16 | 1.63 |
| 2026-10-17 | 3.93 |
| 2026-10-18 | 1.75 |
| 2026-10-19 | 2.69 |
| 2026-10-20 | 1.82 |

### MONIN Hazelnut Syrup 700ml (ml)

Selected configuration: order [1, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 2.46 |
| 2026-10-15 | 1.18 |
| 2026-10-16 | 1.27 |
| 2026-10-17 | 3.31 |
| 2026-10-18 | 3.50 |
| 2026-10-19 | 1.24 |
| 2026-10-20 | 1.71 |

### MONIN Mango Syrup 700ml (ml)

Selected configuration: order [1, 1, 0], seasonal order [1, 1, 1, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.15 |
| 2026-10-15 | 0.21 |
| 2026-10-16 | 0.17 |
| 2026-10-17 | 0.35 |
| 2026-10-18 | 0.15 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.26 |

### MONIN Passion Fruit Syrup 700ml (ml)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 2.81 |
| 2026-10-15 | 2.81 |
| 2026-10-16 | 2.08 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### MONIN Peppermint Syrup 700ml (ml)

Selected configuration: order [1, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.43 |
| 2026-10-15 | 0.24 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 0.89 |
| 2026-10-18 | 1.04 |
| 2026-10-19 | 0.12 |
| 2026-10-20 | 0.24 |

### MONIN Strawberry Syrup 700ml (ml)

Selected configuration: order [2, 1, 2], seasonal order [1, 1, 1, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.75 |
| 2026-10-15 | 0.88 |
| 2026-10-16 | 0.73 |
| 2026-10-17 | 1.51 |
| 2026-10-18 | 1.36 |
| 2026-10-19 | 0.37 |
| 2026-10-20 | 0.84 |

### MONIN White Chocolate Sauce 500ml (ml)

Selected configuration: order [2, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday_calendar features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.46 |
| 2026-10-15 | 0.01 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 0.86 |
| 2026-10-18 | 0.12 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.27 |

### Monterey Beef Sirloin 1kg (g)

Selected configuration: order [1, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 42.36 |
| 2026-10-15 | 3.76 |
| 2026-10-16 | 9.49 |
| 2026-10-17 | 59.14 |
| 2026-10-18 | 13.41 |
| 2026-10-19 | 11.67 |
| 2026-10-20 | 10.42 |

### Nestlé All Purpose Cream 250ml (ml)

Selected configuration: order [1, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 28.95 |
| 2026-10-15 | 33.02 |
| 2026-10-16 | 29.28 |
| 2026-10-17 | 91.24 |
| 2026-10-18 | 75.14 |
| 2026-10-19 | 48.14 |
| 2026-10-20 | 31.48 |

### Oatside Barista Blend Oat Milk 1L (ml)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Oreo Original Cookies 133g (g)

Selected configuration: order [0, 1, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Pampanga’s Best Pork Tocino 450g (g)

Selected configuration: order [2, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Pampanga’s Best Skinless Longganisa 450g (g)

Selected configuration: order [2, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.52 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Pure Ice Food Grade Ice 5kg (g)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 345.24 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Purefoods Pepperoni 250g (g)

Selected configuration: order [1, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 18.12 |
| 2026-10-15 | 5.77 |
| 2026-10-16 | 25.32 |
| 2026-10-17 | 5.82 |
| 2026-10-18 | 5.82 |
| 2026-10-19 | 5.82 |
| 2026-10-20 | 11.02 |

### Real Lemon Lemon Juice 250ml (ml)

Selected configuration: order [1, 0, 0], seasonal order [1, 0, 0, 7], raw transform, level features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 37.04 |
| 2026-10-15 | 37.93 |
| 2026-10-16 | 37.31 |
| 2026-10-17 | 35.83 |
| 2026-10-18 | 35.83 |
| 2026-10-19 | 35.83 |
| 2026-10-20 | 37.09 |

### San Remo Spaghetti Pasta 500g (g)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 119.60 |
| 2026-10-15 | 43.57 |
| 2026-10-16 | 22.98 |
| 2026-10-17 | 985.70 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 56.22 |

### Sarangani Bay Boneless Bangus 450g (g)

Selected configuration: order [1, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 9.98 |
| 2026-10-15 | 11.77 |
| 2026-10-16 | 10.69 |
| 2026-10-17 | 6.29 |
| 2026-10-18 | 6.30 |
| 2026-10-19 | 6.30 |
| 2026-10-20 | 8.24 |

### Soy Taho with Arnibal 1kg (g)

Selected configuration: order [1, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 2.18 |
| 2026-10-15 | 2.23 |
| 2026-10-16 | 3.16 |
| 2026-10-17 | 3.16 |
| 2026-10-18 | 3.16 |
| 2026-10-19 | 3.16 |
| 2026-10-20 | 2.73 |

### Spanish Sardines in Olive Oil 220g (g)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 11.51 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### TOP Creamery Atok Benguet Arabica Coffee Beans Premium Grade 1kg (g)

Selected configuration: order [2, 1, 1], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 65.14 |
| 2026-10-15 | 77.99 |
| 2026-10-16 | 72.92 |
| 2026-10-17 | 64.38 |
| 2026-10-18 | 37.31 |
| 2026-10-19 | 56.57 |
| 2026-10-20 | 66.36 |

### TOP Creamery Milk Tea Series Matcha Powder 500g (g)

Selected configuration: order [1, 0, 0], seasonal order [1, 0, 0, 7], raw transform, level features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 14.73 |
| 2026-10-15 | 14.97 |
| 2026-10-16 | 15.03 |
| 2026-10-17 | 16.87 |
| 2026-10-18 | 16.87 |
| 2026-10-19 | 16.87 |
| 2026-10-20 | 15.30 |

### TOP Creamery Pre-Cut Tissue Napkins 100pcs (pcs)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 11.74 |
| 2026-10-18 | 16.59 |
| 2026-10-19 | 2.96 |
| 2026-10-20 | 0.00 |

### Tostitos Restaurant Style Tortilla Chips 283g (g)

Selected configuration: order [1, 0, 0], seasonal order [1, 0, 0, 7], raw transform, level features; 182 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 29.61 |
| 2026-10-15 | 29.58 |
| 2026-10-16 | 28.55 |
| 2026-10-17 | 30.60 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 26.50 |
| 2026-10-20 | 28.99 |

### Twinings Chai Tea Bags 20s (pcs)

Selected configuration: order [0, 1, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 0.00 |
| 2026-10-18 | 0.00 |
| 2026-10-19 | 0.00 |
| 2026-10-20 | 0.00 |

### Victorias Refined Sugar 1kg (g)

Selected configuration: order [1, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 32.10 |
| 2026-10-15 | 39.47 |
| 2026-10-16 | 35.02 |
| 2026-10-17 | 55.12 |
| 2026-10-18 | 52.12 |
| 2026-10-19 | 35.11 |
| 2026-10-20 | 37.76 |

### Wilkins Pure Bottled Water 500ml (pcs)

Selected configuration: order [1, 0, 0], seasonal order [0, 0, 0, 7], log1p transform, weekday features; 365 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.13 |
| 2026-10-15 | 0.07 |
| 2026-10-16 | 0.07 |
| 2026-10-17 | 0.16 |
| 2026-10-18 | 0.12 |
| 2026-10-19 | 0.05 |
| 2026-10-20 | 0.13 |

### Wilkins Purified Water 6L (ml)

Selected configuration: order [0, 0, 0], seasonal order [1, 0, 0, 7], log1p transform, level features; 1016 fitting days.

| Date | Predicted usage |
|---|---:|
| 2026-10-14 | 0.00 |
| 2026-10-15 | 0.00 |
| 2026-10-16 | 0.00 |
| 2026-10-17 | 354.50 |
| 2026-10-18 | 67.85 |
| 2026-10-19 | 91.89 |
| 2026-10-20 | 0.00 |
