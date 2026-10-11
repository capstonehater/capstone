# Database performance improvements — October 10, 2026

## Implemented

- Sales overview and variant margins now use database aggregates. Recent orders and ranked variants are limited in the query instead of loading transaction history and slicing it in JavaScript.
- The POS dashboard uses aggregate totals for three comparison periods, a product aggregate, and at most 24 hourly rows. Its recent-order query remains bounded.
- Sales analytics loads daily sales/refund aggregates, then combines them into the existing daily, weekly, or monthly response. Previous-period comparisons use aggregate totals. Decimal arithmetic, refund attribution, payment filters, and Manila business dates are preserved.
- Peak-hours reporting loads at most 24 rows. Weekday/weekend filtering runs in PostgreSQL using Manila time.
- `GET /orders` now returns `{ orders, pagination }`, defaults to 20 orders, and caps the page size at 100. It accepts `page`, `pageSize`, and an optional order ID `cursor`. Staff history uses cursors for Next/Previous navigation, resets to page 1 on filter changes, and retains receipt/refund actions and the offline queue.
- Added B-tree indexes on `(status, completed_at, id)`, `(completed_at, id)`, and `(created_by_user_id, completed_at, id)` to support report predicates and history ordering.

Cursor navigation skips only the cursor row. Explicit page requests without a cursor remain available for compatibility with the admin history report. Counts still cover all matching transactions; very deep offset requests and unrestricted all-history aggregates can still become expensive.

The variant aggregate selects the latest historical name/SKU snapshot for each variant. Deleted variants continue to use `deleted:<snapshot SKU>` as their grouping key. Revenue/margin ties now have a deterministic variant key order.

## Local measurements

Database: `ims_samples` on PostgreSQL 18.3, with 3,306 orders. These are service-call timings over the full stored date range, measured on the local machine after warm-up. Each figure is the median of five runs. Both implementations used the same data snapshot and indexes. These measurements exclude browser rendering and network latency and are not a large-scale load test.

| Report | Previous code | Optimized code |
| --- | ---: | ---: |
| Sales overview | 360.84 ms | 34.91 ms |
| Variant margin | 148.53 ms | 26.89 ms |
| POS dashboard | 259.39 ms | 18.83 ms |
| Peak hours | 169.28 ms | 3.34 ms |
| Sales analytics | 187.16 ms | 26.20 ms |

For a representative recent-orders query, `EXPLAIN (ANALYZE, BUFFERS)` changed from a scan/sort to an index-only scan. Execution time was 0.936 ms before the index and 0.060 ms afterward; shared buffer hits dropped from 91 to 3. These are single local query-plan observations, not percentile guarantees.

## Verification

- 239 report/order tests passed across 11 suites, including pagination defaults, complete page traversal, cursor navigation, cashier filters, empty results, input validation, and existing authorization checks.
- 38 read-only comparisons against the previous report implementation passed on the local database. Cases include empty/full ranges, daily/weekly/monthly groups, payment methods, staff/combined filters, open-ended dates, Manila midnight boundaries, and database sessions set to UTC and America/New_York.
- Cursor traversal returned the same first 60 order IDs as a single ordered read, without gaps or duplicates.
- Backend production build, frontend TypeScript check, and Prisma schema validation passed.
- The broad backend TypeScript check also includes existing test files and still reports their unrelated typing errors. The production build excludes those test files and passes.

Reproduce the read-only comparison from `ims-backend`:

```powershell
node scripts/verify-report-optimization.cjs dd5f0543305ae8bfc5bfac6d9ffae11d637e18a9 --benchmark
```

The script uses the configured database, starts a read-only repeatable-read transaction, and prints only counts/timings or names of differing fields. It does not insert or update business records.

## Migration and deployment

Both new migrations were applied to the local `ims_samples` database and recorded in Prisma migration history. All three indexes were verified valid:

- `20261010000000_order_reporting_indexes`
- `20261010010000_staff_order_history_index`

An existing migration, `20260922000000_convert_voided_orders_to_refunds`, is still pending locally. It changes historical order data and was not applied as part of this optimization. Review it before running a general migration deployment, which would also apply outstanding migrations.

The index migrations use `CREATE INDEX CONCURRENTLY` and must run outside an explicit transaction. Concurrent index builds allow ordinary writes to continue, with additional database work during creation. [PostgreSQL CREATE INDEX documentation](https://www.postgresql.org/docs/18/sql-createindex.html)

Deploy the backend and frontend together: consumers of `/orders` must now use pagination to access the entire history. The staff page in this repository is updated. For another environment, verify its migration status, then apply the migrations through the normal deployment process.

SQL values use parameterized `Prisma.sql` fragments. UTC date bounds are bound as ISO strings and cast to `timestamp`, avoiding a session-timezone shift from casting a bound JavaScript Date directly. [Prisma 6 raw-query documentation](https://www.prisma.io/docs/orm/v6/prisma-client/using-raw-sql/raw-queries)

## Further scaling

Measure p95 latency, database CPU, memory, and connection usage with representative concurrent checkouts and report reads before changing hardware, pool sizes, or database settings. This work has not validated million-row workloads. Payment allocation, inventory-linked reports, and other reports still contain history reads that may need their own measured optimization.

If broad historical reports remain expensive at that scale, daily summary tables or materialized views can reduce repeated scans. Define update and refund correction behavior before caching financial totals. Keep authoritative stock and checkout validation current. Partitioning and archival should follow measured table growth and a retention policy rather than an arbitrary row threshold.
