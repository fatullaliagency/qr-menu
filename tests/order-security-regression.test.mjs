import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Source-level security regression checks. These guard critical scoping
 * and privacy invariants as the UI changes. They are NOT authenticated
 * end-to-end tests or substitutes for database authorization tests.
 */
function source(path) {
  return readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

const kitchen = source("app/admin/orders/kitchen/page.tsx");
const print = source("app/admin/orders/[id]/print/page.tsx");
const notifications = source("app/admin/orders/notifications/route.ts");
const notificationClient = source("app/admin/orders/OrdersAutoRefresh.tsx");
const admin = source("app/admin/orders/page.tsx");
const writes = source("app/lib/order-write-service.ts");
const customerOrders = source("app/[slug]/order-actions.ts");
const tracking = source("app/order/track/[id]/status/route.ts");
const historyFlag = source("app/lib/order-status-history.ts");

function part(content, start, end) {
  const first = content.indexOf(start);
  const last = content.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Expected source section: ${start}`);
  return content.slice(first, last);
}

test("Kitchen view authenticates before reading any order data", () => {
  assert.match(kitchen, /const session = await getAdminSession\(\)/);
  assert.match(kitchen, /if \(!session\)/);
  assert.ok(kitchen.indexOf("if (!session)") < kitchen.indexOf("db.order.groupBy("));
  assert.ok(kitchen.indexOf("if (!session)") < kitchen.indexOf("db.order.findMany("));
});

test("Kitchen status totals and order listing are both restricted to the session tenant", () => {
  assert.match(kitchen, /restaurantId: session\.restaurantId/);
  assert.match(kitchen, /const where: Prisma\.OrderWhereInput = \{\s*restaurantId: session\.restaurantId/);
  assert.match(kitchen, /db\.order\.groupBy\(\{[\s\S]*?where: \{ restaurantId: session\.restaurantId, status:/);
  assert.match(kitchen, /db\.order\.findMany\(\{\s*where,/);
  assert.match(kitchen, /parseKitchenStatus\(query\.status\)/);
});

test("Kitchen database selection does not include customer contact or financial fields", () => {
  for (const forbidden of ["customerPhone", "customerName", "addressText", "customerNote", "paymentStatus", "total: true"]) {
    assert.equal(kitchen.includes(forbidden), false, `Kitchen must not select: ${forbidden}`);
  }
  assert.match(kitchen, /select: \{ id: true, name: true, quantity: true \}/);
});

test("Print receipt requires session and checks both order ID and tenant in query", () => {
  assert.match(print, /const session = await getAdminSession\(\)/);
  assert.match(print, /if \(!session\) redirect\("\/admin"\)/);
  assert.match(print, /where: \{\s*id,\s*restaurantId: session\.restaurantId/);
  assert.match(print, /if \(!order\) notFound\(\)/);
  assert.match(print, /select: \{ id: true, name: true, quantity: true \}/);
  for (const forbidden of ["customerPhone", "customerName", "addressText", "customerNote", "paymentStatus", "total: true"]) {
    assert.equal(print.includes(forbidden), false, `Print must not select: ${forbidden}`);
  }
});

test("Order notification endpoint requires session and returns only a tiny no-store payload", () => {
  assert.match(notifications, /const session = await getAdminSession\(\)/);
  assert.match(notifications, /status: 401, headers: NO_STORE/);
  assert.match(notifications, /private, no-store/);
  assert.equal((notifications.match(/restaurantId: session\.restaurantId/g) ?? []).length, 3);
  assert.match(notifications, /select: \{ id: true, createdAt: true \}/);
  // The creation watermark MUST include already-confirmed orders, not only NEW ones.
  assert.match(notifications, /where: \{ restaurantId: session\.restaurantId \},\s*orderBy:/);
  assert.doesNotMatch(notifications, /where: \{ restaurantId: session\.restaurantId, status: "NEW" \},\s*orderBy:/);
  assert.match(notificationClient, /shouldNotifyOfOrder\(/);
  assert.doesNotMatch(notificationClient, /data\.newCount > 0/);
  for (const forbidden of ["customerPhone", "customerName", "addressText", "customerNote", "paymentStatus", "total: true"]) {
    assert.equal(notifications.includes(forbidden), false);
  }
});

test("Order alert watermark is reset across restaurant sessions without replaying alerts", () => {
  assert.match(notifications, /scope: session\.restaurantId/);
  assert.match(notificationClient, /typeof data\.scope !== "string"/);
  assert.match(notificationClient, /scopeRef\.current !== null && scopeRef\.current !== data\.scope/);
  assert.match(notificationClient, /hasBaseline\.current = false;/);
  assert.match(notificationClient, /latestRef\.current = null;/);
  assert.match(notificationClient, /setLastAlert\(null\)/);
  assert.match(notificationClient, /alertsEnabledRef\.current = false;/);
  assert.match(notificationClient, /scopeRef\.current = data\.scope;/);
});

test("All status changes retain session authorization and conditional tenant writes", () => {
  const action = part(admin, "async function updateOrderStatus(", "// Nağd pul");
  assert.match(action, /const session = await getAdminSession\(\)/);
  assert.match(action, /!canTransitionOrder\(currentStatus, nextStatus\)/);
  assert.match(action, /writeOrderStatus\(db, \{[\s\S]*?restaurantId: session\.restaurantId/);
  assert.match(action, /historyEnabled: orderHistoryEnabled\(\)/);
  assert.match(action, /if \(!changed\)/);
  assert.match(writes, /restaurantId: input\.restaurantId,\s*status: input\.currentStatus/);
  assert.match(writes, /order\.updateMany\(\{ where, data \}\)/);
  assert.match(writes, /if \(result\.count !== 1\) return false/);
  assert.match(writes, /tx\.orderStatusEvent\.create\(/);
});

test("Cash receipt update is single-tenant, conditional, and never automatic", () => {
  const action = part(admin, "async function confirmCashPayment(", "export default function OrdersPage");
  assert.match(action, /const session = await getAdminSession\(\)/);
  assert.match(action, /writeCashReceipt\(db, \{\s*id: orderId,\s*restaurantId: session\.restaurantId/);
  assert.match(action, /if \(!changed\)/);
  assert.match(writes, /database\.order\.updateMany\(\{\s*where: \{\s*id: input\.id,\s*restaurantId: input\.restaurantId/);
  assert.match(writes, /status: "DELIVERED"/);
  assert.match(writes, /paymentMethod: "CASH"/);
  assert.match(writes, /paymentStatus: "PENDING"/);
  assert.match(writes, /data: \{ paymentStatus: "PAID" \}/);
});

test("Customer order server checks restaurant ownership and server-calculated price", () => {
  assert.match(customerOrders, /process\.env\.ENABLE_WEB_ORDERS !== "true"/);
  assert.match(customerOrders, /where: \{ restaurantId: restaurant\.id, id: \{ in: \[\.\.\.ids\] \} \}/);
  assert.match(customerOrders, /const cents = Math\.round\(product\.price \* 100\)/);
  assert.match(customerOrders, /restaurantId: restaurant\.id/);
  assert.match(customerOrders, /paymentMethod: "CASH"/);
  assert.match(customerOrders, /paymentStatus: "PENDING"/);
});

test("Customer tracking checks a signed token before any database query", () => {
  assert.match(tracking, /validTrackingToken\(id, token\)/);
  assert.ok(tracking.indexOf("validTrackingToken(id, token)") < tracking.indexOf("db.order.findUnique("));
  assert.match(tracking, /status: 404, headers: NO_STORE/);
  assert.match(tracking, /private, no-store/);
  assert.doesNotMatch(tracking, /customerPhone: true|customerName: true|addressText: true/);
});

test("Order status history stays disabled by default until migration is verified", () => {
  assert.match(historyFlag, /process\.env\.ENABLE_ORDER_STATUS_HISTORY === "true"/);
  assert.doesNotMatch(historyFlag, /\|\| true/);
});
