# Order Status History — staging rollout

This adds the `OrderStatusEvent` table for new order events only. No card integration or old-order backfill is included.

## Mandatory preflight
1. Confirm the Vercel project is **qr-menu-staging** and branch is `feature/orders-v1`.
2. Confirm the target DATABASE_URL is for the **qr-menu-orders-test** database by reading restaurant identifiers before any write. Never point migrations at the main `qr-menu` project.
3. Back up staging database before modification and record current `Restaurant` and `Order` counts.
4. Check `SELECT to_regclass('public."OrderStatusEvent"');` and migration state before applying.
5. Execute `prisma/migrations/20261103_add_order_status_events/migration.sql` on staging **only**.
6. Verify the new table, constraints and indexes exist and original `Restaurant` / `Order` row counts are unchanged.
7. Only then deploy code that writes/reads `OrderStatusEvent`.

## Event data
- `fromStatus` is nullable for order creation; `toStatus` is always required.
- `actor`: CUSTOMER or RESTAURANT.
- `createdAt` represents the actual event time; historical events before release cannot be reliably reconstructed.
- Never include customer name, phone, address, tokens or payment secrets.
- Use a transaction: conditional `Order.updateMany` + `OrderStatusEvent.create`. If update fails, no event should be recorded.
- Restrict all reads by the authenticated owner's `restaurantId`.
