# Restaurant payment configuration — staging rollout

This is an additive database migration. It does **not** enable card processing.

## Deployment order
1. Commit Prisma schema and SQL migration to `feature/orders-v1`.
2. Run `prisma/migrations/20261102_add_restaurant_payment_settings/migration.sql` exactly once **on the staging Prisma PostgreSQL database**. Verify the target database before applying.
3. Check that `RestaurantPaymentSettings` exists and that existing `Restaurant` and `Order` rows are unchanged.
4. Only then deploy UI and server actions that read or write payment settings.

## Data and security
- `taxId`: 10-digit VÖEN; not proof of registration or bank approval.
- `legalName`: legal business name.
- `paymentMode`: requested payment options; `CASH_AND_CARD` does not automatically expose online card checkout.
- `providerName` and `providerMerchantId`: public/non-secret identifiers only.
- `approvalStatus`: administrative record; never independently authorizes a financial transaction.
- **Never store** provider API secrets, private keys, card numbers, CVV or track data in this table or repository. Use provider-approved secure configurations for eventual integrations.
- Real online card checkout must remain disabled until a provider contract, merchant onboarding, secured server-side processing and signed callback/payment verification are in place.

## Read-only verification queries
```sql
SELECT to_regclass('public."RestaurantPaymentSettings"');
SELECT COUNT(*) FROM "Restaurant";
SELECT COUNT(*) FROM "Order";
```
