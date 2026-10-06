# Inventory store availability

`store_price.py` is now a JSON stdin/stdout worker, with no Streamlit dependency.
NestJS runs it with `spawn` (no shell). The existing Serper search, Groq relevance
classifier, price extraction, and market-estimate logic remain in this module.

Setup:

1. Install Python dependencies: `python -m pip install -r "AI-Store Reco/requirements.txt"`.
2. Configure `SERPER_API_KEY` and `GROQ_API_KEY` in the backend environment or
   `AI-Store Reco/.env`. Never put keys in frontend environment variables.
3. From `ims-backend`, run `npx prisma generate` and `npx prisma migrate deploy`.
4. Restart the backend. Default execution assumes its working directory is
   `ims-backend`. Override `STORE_PRICE_SCRIPT` with an absolute script path and
   `STORE_SEARCH_PYTHON` with the Python executable path when deploying elsewhere.
5. Add searchable retail stores in Manage Suppliers, then select a material in
   Inventory Summary → Store Availability → Search.

The database material ID identifies the product; its current name is snapshotted
as the query. Registered suppliers are passed directly from PostgreSQL, so no
locations CSV is required. Saved addresses target the web search to the registered branch; coordinates are
also supplied to the relevance classifier and serve as query context when an
address is missing. Coordinates are optional for price searches. Each saved
result includes the actual search query for traceability.
Search records and per-store JSON results are saved in
`store_availability_searches` and `store_availability_results` in the existing
database. Supplier details are snapshots so history survives supplier edits.

The API is administrator-only. POST starts a persisted background search and GET
returns the latest search with saved results. The modal polls pending jobs and
can be closed and reopened. Searches have a ten-minute deadline and a 30-store
limit. Failed/interrupted jobs can be retried; previous history remains stored.
For multiple backend replicas, replace the in-process worker with a durable job
queue and a shared concurrency/rate limit before scaling.

Online listings do not prove branch stock. Estimates are explicitly labeled and
source links are retained. For better matching, use material names with brand
and pack size (e.g. `Magnolia Quickmelt Cheese 160g`). A future separate search-name
field would let operators refine queries without renaming inventory materials.

Generic materials now get a single brand-selection pass using fresh web results
and a Groq prompt. It prefers a widely available Philippine-market brand backed
by the supplied listings, preserves explicitly requested brands and sizes, and
keeps the original query when evidence or the provider is unavailable. The same
chosen brand is used for every store and saved with each result. The modal shows
the chosen brand, green confirmed-listing badges, blue estimate badges, and gray
no-listing/price or search-unavailable badges. Existing results acquire brand
metadata on the next search; no database migration is needed.

Checks: `python -m unittest discover -s "AI-Store Reco" -p "test_*.py"`.
