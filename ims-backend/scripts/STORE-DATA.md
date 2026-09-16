# Refresh saved store data

Run these commands from `ims-backend`.

List active materials that already have store searches, including their IDs,
latest status, number of saved store rows, and completion time:

```powershell
npm run store-data -- --list
```

Preview a bulk refresh without database changes or provider requests:

```powershell
npm run store-data -- --all --dry-run
```

Refresh all previously searched active materials:

```powershell
npm run store-data -- --all
```

Refresh one active material (copy its ID from the list, or use an existing raw
material ID to run its first search):

```powershell
npm run store-data -- --material YOUR_MATERIAL_ID
```

The tool uses the backend `.env` database connection and the existing Python
Serper/Qwen configuration. No running HTTP server or browser login is needed;
this is a local maintenance tool for someone with database access. It does not
restart the login server or start background inventory jobs.

Each refresh uses the current registered suppliers, collects fresh Serper
evidence, commits it to the database, reads it back for Qwen, and saves the new
recommendations. Materials run sequentially. Keep the command open until its
summary appears. An already-running search is awaited instead of deliberately
starting another. Run only one bulk refresh tool at a time.

The tool creates a new search snapshot and preserves history. Scraped snippets,
prices, availability statements, source URLs, distance, and recommendations
are stored in **`store_availability_results.payload`**. Each row's `search_id`
links to **`store_availability_searches.id`**, whose `raw_material_id` identifies
the inventory material. Inventory stock quantities are not modified by this tool.

The modal displays the latest snapshot when reopened. Failed refreshes are
reported and the remaining materials continue; the process exits with code 1
if any material failed. A `COMPLETED` search means processing finished, not that
every store supplied a price or that Qwen was available. Review per-store status
and any rule-based fallback labels in the modal.

To inspect saved rows in a database client:

```sql
SELECT s.raw_material_id, s.product_name, s.status, s.created_at,
       r.id AS result_id, r.payload
FROM store_availability_searches AS s
JOIN store_availability_results AS r ON r.search_id = s.id
ORDER BY s.created_at DESC, r.id;
```

`--list`, `--dry-run`, and `--help` do not start refreshes. Live refresh modes
use the configured Serper and Groq API quotas.
