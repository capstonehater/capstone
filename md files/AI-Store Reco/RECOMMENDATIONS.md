# Saved stock-run recommendations

The Store Availability modal now uses this database-first workflow:

1. The backend loads registered stores from Manage Suppliers.
2. `store_price.py` runs with `collect_only=true`: Serper supplies search
   snippets and URLs; Python extracts preliminary prices and explicit stock
   statements. This stage makes no Qwen calls and preserves the product query.
   If a full-address search has no usable product price, it retries with the
   product and store chain. General-market fallback evidence is also saved so
   the review stage can validate it without losing the estimate.
3. The backend commits each result to `StoreAvailabilityResult.payload`, including
   `search_evidence`, `search_sources`, prices, availability evidence, distance,
   and `fetched_at`. The search changes from `PENDING` to `RANKING`.
4. The backend reads those committed records back from PostgreSQL and sends them
   to `store_recommendation.py` with `persisted=true`. Python does not need
   database credentials. Qwen reviews saved price matches, then selects and
   explains Top 1?5 from the saved evidence. This stage makes no Serper requests.
5. Rankings and reasons are saved under each payload's `recommendation` field,
   atomically with the search becoming `COMPLETED`. The modal reads this data
   through the existing GET endpoint and sorts by the persisted rank.

No schema migration is needed: evidence and recommendations use the existing
JSON payload column. Old searches remain readable; click Search again to obtain
rankings. During ranking the modal can already show committed Serper results.
A worker failure preserves collected evidence and marks the search failed.
Invalid/unavailable model rankings produce a labeled rule-based fallback.
If every store request fails, the search is marked FAILED and retains diagnostic
rows. The backend and its Python workers need outbound HTTPS access to Serper
and Groq; Windows socket error 10013 indicates blocked network access.

## Ranking rules

Qwen uses distance, affordability, product/pack comparability, source relevance,
and explicit availability evidence. The deterministic baseline uses 60% distance
and 40% price, normalized within the candidate set. Qwen may change that ordering
based on the saved evidence; code still validates unique candidate IDs and ranks.
It cannot change stored prices or invent registered stores through ranking output.

Top 1 requires a positive finite confirmed store/chain price, source URL,
valid coordinates, and no explicit out-of-stock report. Unconfirmed prices
can rank from Top 2 onward. If no store qualifies, Top 1 remains empty and up
to four alternatives fill positions 2?5. Stores reporting out of stock remain
visible in the modal but are excluded from recommendations. Other unselected
registered stores also remain visible below the ranked choices.

Distances use `USER_LATITUDE` and `USER_LONGITUDE` in `store_price.py` and are
straight-line kilometers. A confirmed chain price is not a verified branch
price. Explicit matching snippets can report `IN_STOCK` or `OUT_OF_STOCK`;
missing or conflicting statements produce `UNKNOWN`. Price alone never proves
stock. These are online listing claims at fetch time, not live branch inventory.
The extraction is conservative text matching and may miss differently phrased
availability statements. Search snippets may also be stale or incomplete.

Qwen sees bounded excerpts of the saved search evidence to limit prompt size.
Full normalized search snippets remain persisted. Its explanations should be
evaluated for factual accuracy. Exact SKU, brand, quantity, and pack size in the
product query improve comparisons; the collection stage does not silently
choose another brand before storing evidence.

## Running and testing

The backend uses the existing `.env` keys `SERPER_API_KEY` and `GROQ_API_KEY`.
The model is shared via `store_price.CLASSIFIER_MODEL`.
Optional backend overrides: `STORE_SEARCH_PYTHON`, `STORE_PRICE_SCRIPT`, and
`STORE_RECOMMENDATION_SCRIPT`.

Standalone collection, using JSON with `product`, registered `stores`, and
`collect_only: true`:

```powershell
Get-Content request.json -Raw | python store_price.py
```

Offline/reused evidence ranking, using JSON with `product`, `results`, and
`persisted: true`:

```powershell
Get-Content saved-results.json -Raw | python store_recommendation.py
python -m unittest discover -p 'test_store*.py'
```

Without a Groq key, reused results get rule-based recommendations. The older
standalone recommendation format without `persisted` still returns a ranking
object. The backend always uses the persisted mode and saves its returned rows.

## Future improvements

Add required quantities, exact SKU/pack size, branch stock checks, price age,
opening hours, budget, and road travel costs. For a full stock run, compare
basket cost plus round-trip transport cost and account for missing items.

Start with clear prompts and rule enforcement before fine-tuning. Collect
reviewed store preferences alongside actual receipt prices, availability, and
travel times. Include near-but-unconfirmed and cheap-but-far cases. Evaluate on
held-out dates and stores, measuring rule violations, ranking agreement, total
cost, and wasted trips. Tune baseline weights before investing in training.
