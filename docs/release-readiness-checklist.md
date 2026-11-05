# QR Menü — production release safety gate

Last updated: 2026-11-05. This checklist is informational; it is NOT a production release authorization.

## Automated CI gates (disposable GitHub PostgreSQL)
- Unit, PostgreSQL integration, HTTP and Chromium tests must pass at the current feature HEAD.
- 300 real Next.js `createCashOrder` HTTP Server Action checkouts, 10 bounded concurrent clients; verify 300 unique orders and 300 nested items in one disposable test restaurant. Report observed p50/p95/p99, but do not infer production SLA from GitHub CI.
- `pg_dump --format=custom` and `pg_restore --exit-on-error` into a different disposable PostgreSQL database. Verify all eight application tables by sorted row-content SHA-256 and row count, then verify independent databases by a restore-only write.
- Never run benchmark, database dump or restore steps against staging or production database URLs. All test scripts require exact CI loopback URLs and ephemeral flag.

## Read-only production release audit
- Confirm `main` and Vercel production project `qr-menu` were NOT changed by feature tests; inspect the feature/main diff and current CI/deploy state.
- Identify the target production database and validate a restorable production backup using an approved process *before* any migration or release; the CI restore test does not substitute for this.
- Verify production runtime flags, session secrets, merchant/card payment disabled, and database isolation without disclosing secret values.
- Confirm physical-device audible alert and OS notification behavior, browser background limitations and staff training. Chromium audio mocking cannot prove sound volume or OS delivery on a phone.
- Validate actual hosting traffic/performance, reliability monitoring, rollback, DNS and schema compatibility; 300 requests in a local CI container do not establish Vercel production capacity.
- Obtain explicit deployment approval and schedule before merging `feature/orders-v1` into `main`. Do not deploy or migrate the real production environment as part of these checks.

## Go/no-go
CI tests passing makes this branch a *release candidate*, not a production-certified service. Leave production unchanged if any manual or production-specific checks remain unverified.
