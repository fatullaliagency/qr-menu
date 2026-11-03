import "server-only";

// Enable ONLY after the additive OrderStatusEvent migration has been applied
// and verified on the isolated staging PostgreSQL database. The default
// remains false, so existing order operations continue without this table.
export function orderHistoryEnabled(): boolean {
  return process.env.ENABLE_ORDER_STATUS_HISTORY === "true";
}
