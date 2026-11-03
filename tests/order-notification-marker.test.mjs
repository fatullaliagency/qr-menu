import test from "node:test";
import assert from "node:assert/strict";
import { isLaterOrderMarker, shouldNotifyOfOrder, orderAlertLink } from "../app/lib/order-notification-marker.ts";

const first = { id: "a100", createdAt: "2026-11-04T08:00:00.000Z" };
const later = { id: "a101", createdAt: "2026-11-04T08:00:01.000Z" };

test("Initial page loading never replays an existing order alert", () => {
  assert.equal(shouldNotifyOfOrder(first, null, false), false);
  assert.equal(shouldNotifyOfOrder(null, null, false), false);
});

test("New first order is detected after an empty baseline", () => {
  assert.equal(shouldNotifyOfOrder(first, null, true), true);
});

test("New order is detected even if already confirmed before polling", () => {
  // A creation marker is independent of order status and NEW count.
  assert.equal(shouldNotifyOfOrder(later, first, true), true);
});

test("Repeated polls and status changes never replay the same order", () => {
  assert.equal(shouldNotifyOfOrder(first, first, true), false);
  assert.equal(shouldNotifyOfOrder(null, first, true), false);
});

test("Older or removed newest order does not move alert watermark backward", () => {
  assert.equal(isLaterOrderMarker(first, later), false);
  assert.equal(isLaterOrderMarker(null, later), false);
});

test("Equal timestamps are compared by order ID consistently with the DB", () => {
  const twin = { id: "a101", createdAt: first.createdAt };
  assert.equal(isLaterOrderMarker(twin, first), true);
  assert.equal(isLaterOrderMarker(first, twin), false);
});

test("Notification link locates the order without requiring NEW status", () => {
  assert.equal(orderAlertLink("cmxy0123456789abcdefgh"), "/admin/orders?q=abcdefgh");
  assert.equal(orderAlertLink("abcd"), "/admin/orders?q=abcd");
  assert.equal(orderAlertLink("id"), "/admin/orders");
  assert.equal(orderAlertLink("unknown/🚀"), "/admin/orders");
  assert.equal(orderAlertLink(null), "/admin/orders");
});
