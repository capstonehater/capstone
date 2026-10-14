# Full enrolled-material SARIMA forecast

Period: October 15?21, 2026. Materials: 84. Forecasted: 15. Excluded: 69.

Source: fresh read-only database snapshot, actual completed POS consumption, isolated copied application code and virtualenv. Original SARIMA grid and rolling validation; no model mocks or substitute models. Current partial Philippine day excluded. No forecast runs were written to the database.

| Material | Unit | Status | 7-day total | Validation MAPE | Reason |
|---|---|---|---:|---:|---|
| Alaska Classic Evaporated Filled Milk 370ml | ml | excluded | ? | ? | object of type 'NoneType' has no len() |
| Alaska Condensed Milk 390g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Arla Mozzarella Cheese 200g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Arla Whipping Cream 1L | ml | excluded | ? | ? | No compatible completed POS history is available |
| Bounty Fresh Large Eggs 12s | pcs | forecasted | 5.7 | 61.23 |  |
| Butterfly Pea Flower Dried 100g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Campfire Mini Marshmallows 300g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Century Tuna Flakes in Oil 180g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| ChaTraMue Original Thai Tea Mix 400g | g | excluded | ? | ? | object of type 'NoneType' has no len() |
| Cocoa Powder | g | excluded | ? | ? | No compatible completed POS history is available |
| Datu Puti Vinegar 1L | ml | excluded | ? | ? | object of type 'NoneType' has no len() |
| Del Monte Peach Halves 825g | g | excluded | ? | ? | object of type 'NoneType' has no len() |
| Del Monte Tomato Sauce 1kg | g | forecasted | 410.99 | 74.91 |  |
| DoÃƒÂ±a Maria Jasponica Rice 5kg | g | forecasted | 0.04 | 44.79 |  |
| Eden Original Cheese 180g | g | forecasted | 61.18 | 69.83 |  |
| Farm Frites Frozen French Fries 1kg | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Fidel Iodized Salt 1kg | g | excluded | ? | ? | object of type 'NoneType' has no len() |
| Filippo Berio Basil Pesto 190g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Food Grade PET Sauce Bottle 150ml | pcs | excluded | ? | ? | SARIMA requires varying usage history; constant history cannot be Box-Cox transformed |
| Fresh Garlic 1kg | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Fresh Iceberg Lettuce 1kg | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Fresh Lakatan Banana 1kg | g | excluded | ? | ? | object of type 'NoneType' has no len() |
| Fresh Medium Shrimp 1kg | g | excluded | ? | ? | object of type 'NoneType' has no len() |
| Fresh Philippine Mango 1kg | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Fresh Philippine Red Chili Peppers 1kg | g | excluded | ? | ? | object of type 'NoneType' has no len() |
| Fresh Pizza Dough 250g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Fresh Red Onion 1kg | g | forecasted | 110.12 | 45.43 |  |
| Fresh Strawberries 500g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Golden Fiesta Canola Oil 1L | ml | excluded | ? | ? | object of type 'NoneType' has no len() |
| Greenware 12oz Double Wall Paper Cup | pcs | excluded | ? | ? | object of type 'NoneType' has no len() |
| Greenware 12oz Sip Hole Lid | pcs | excluded | ? | ? | object of type 'NoneType' has no len() |
| Greenware 22oz Cold Drink Cup | pcs | excluded | ? | ? | object of type 'NoneType' has no len() |
| Greenware 22oz Dome Lid | pcs | excluded | ? | ? | object of type 'NoneType' has no len() |
| Greenware Paper Drinking Straw 100s | pcs | excluded | ? | ? | object of type 'NoneType' has no len() |
| Greenware Sugarcane Bagasse Bento Box | pcs | excluded | ? | ? | object of type 'NoneType' has no len() |
| Hershey's Chocolate Syrup 623g | g | forecasted | 154.5 | 36.16 |  |
| Huy Fong Sriracha Hot Chili Sauce 481g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Kirkland Signature Macadamia Nuts 680g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Knorr Salted Egg Powder 500g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Kraft Grated Parmesan Cheese 85g | g | forecasted | 99.78 | 55.65 |  |
| Lee Kum Kee Korean BBQ Sauce 240g | g | excluded | ? | ? | object of type 'NoneType' has no len() |
| Lipton Yellow Label Black Tea Bags 100s | pcs | excluded | ? | ? | object of type 'NoneType' has no len() |
| Lotus Biscoff Spread 400g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| MILO Chocolate Malt Powder 300g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| MONIN Caramel Syrup 700ml | ml | forecasted | 76.27 | 42.73 |  |
| MONIN French Vanilla Syrup 700ml | ml | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| MONIN Hazelnut Syrup 700ml | ml | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| MONIN Mango Syrup 700ml | ml | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| MONIN Passion Fruit Syrup 700ml | ml | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| MONIN Peppermint Syrup 700ml | ml | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| MONIN Strawberry Syrup 700ml | ml | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| MONIN White Chocolate Sauce 500ml | ml | excluded | ? | ? | object of type 'NoneType' has no len() |
| Magnolia Chicken Wings 1kg | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Magnolia Cream Cheese 225g | g | excluded | ? | ? | object of type 'NoneType' has no len() |
| Magnolia Fresh Milk 1L | ml | forecasted | 9736.19 | 88.49 |  |
| Magnolia Gold Butter Salted 225g | g | forecasted | 77.03 | 40.96 |  |
| Mascarpone Cheese 250g | g | excluded | ? | ? | No compatible completed POS history is available |
| Matilde Vicenzi Vicenzovo Ladyfingers | g | excluded | ? | ? | No compatible completed POS history is available |
| Maya All Purpose Flour 2kg | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Maya Japanese Bread Crumbs 200g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| McCormick Ground Black Pepper 80g | g | excluded | ? | ? | object of type 'NoneType' has no len() |
| Milktea Powder | g | excluded | ? | ? | No compatible completed POS history is available |
| Mission Soft Flour Tortillas 10s | pcs | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Monterey Beef Sirloin 1kg | g | forecasted | 120.06 | 76.79 |  |
| NestlÃƒÂ© All Purpose Cream 250ml | ml | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Oatside Barista Blend Oat Milk 1L | ml | excluded | ? | ? | SARIMA requires varying usage history; constant history cannot be Box-Cox transformed |
| Oreo Original Cookies 133g | g | excluded | ? | ? | object of type 'NoneType' has no len() |
| PampangaÃ¢â‚¬â„¢s Best Pork Tocino 450g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| PampangaÃ¢â‚¬â„¢s Best Skinless Longganisa 450g | g | excluded | ? | ? | object of type 'NoneType' has no len() |
| Pure Ice Food Grade Ice 5kg | g | excluded | ? | ? | object of type 'NoneType' has no len() |
| Purefoods Pepperoni 250g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Real Lemon Lemon Juice 250ml | ml | forecasted | 0.0 | 41.5 |  |
| San Remo Spaghetti Pasta 500g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Sarangani Bay Boneless Bangus 450g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Soy Taho with Arnibal 1kg | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Spanish Sardines in Olive Oil 220g | g | excluded | ? | ? | object of type 'NoneType' has no len() |
| TOP Creamery Atok Benguet Arabica Coffee Beans Premium Grade 1kg | g | forecasted | 890.06 | 160.94 |  |
| TOP Creamery Milk Tea Series Matcha Powder 500g | g | forecasted | 3004.09 | 60.23 |  |
| TOP Creamery Pre-Cut Tissue Napkins 100pcs | pcs | excluded | ? | ? | object of type 'NoneType' has no len() |
| Tostitos Restaurant Style Tortilla Chips 283g | g | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Twinings Chai Tea Bags 20s | pcs | excluded | ? | ? | object of type 'NoneType' has no len() |
| Victorias Refined Sugar 1kg | g | forecasted | 308.04 | 62.73 |  |
| Wilkins Pure Bottled Water 500ml | pcs | excluded | ? | ? | No validated SARIMA model passed the forecast range checks (1 candidates); material excluded from this run |
| Wilkins Purified Water 6L | ml | excluded | ? | ? | object of type 'NoneType' has no len() |

Validation MAPE is rolling historical validation, not future forecast accuracy. Model prediction intervals have not been independently calibrated. Convergence warnings are recorded per material; finite forecasts alone do not establish optimizer convergence.

Total convergence warnings: 3428.

## Final verification

- All 84 active material IDs from the fresh snapshot appear exactly once in results.
- All 15 returned forecasts contain seven calendar dates and finite, nonnegative, ordered prediction ranges.
- Current backend validateWorkerResult accepted all 15 series / 105 daily points.
- 35 materials failed forecast range checks; 27 hit a training NoneType error; 5 had no compatible catalog/POS history; 2 had constant history.
- Historical rolling-validation MAPE among returned forecasts spans 36.16%?160.94%. These forecasts need review before operational use.
- One-day gap (October 14) was forecast internally because the latest covered POS day was October 13.
- This run completed in 21 minutes 31 seconds. No production forecast records were written.