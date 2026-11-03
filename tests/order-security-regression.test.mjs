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
const admin = source("app/admin/orders/page.tsx");
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
  for (const forbidden of ["customerPhone", "customerName", "addressText", "customerNote", "paymentStatus", "total: true"]) {
    assert.equal(notifications.includes(forbidden), false);
  }
});

test("All status changes condition on both tenant and previous status", () => {
  const action = part(admin, "async function updateOrderStatus(", "// Nağd pul");
  assert.match(action, /const session = await getAdminSession\(\)/);
  assert.match(action, /!canTransitionOrder\(currentStatus, nextStatus\)/);
  assert.equal((action.match(/restaurantId: session\.restaurantId/g) ?? []).length, 3);
  assert.equal((action.match(/status: currentStatus/g) ?? []).length, 2);
  assert.match(action, /if \(!changed\)/);
  assert.match(action, /if \(result\.count !== 1\) return false/);
  assert.match(action, /tx\.orderStatusEvent\.create\(/);
});

test("Cash receipt update is single-tenant, conditional, and never automatic", () => {
  const action = part(admin, "async function confirmCashPayment(", "export default function OrdersPage");
  assert.match(action, /const session = await getAdminSession\(\)/);
  assert.match(action, /db\.order\.updateMany\(/);
  assert.match(action, /id: orderId,\s*restaurantId: session\.restaurantId,\s*\.\.\.CASH_PENDING_CONDITIONS/);
  assert.match(action, /data: \{ paymentStatus: "PAID" \}/);
  assert.match(action, /if \(result\.count !== 1\)/);
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
