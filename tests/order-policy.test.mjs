import test from "node:test";
import assert from "node:assert/strict";

import {
  NEXT_STATUSES,
  isOrderStatus,
  canTransitionOrder,
  CASH_PENDING_CONDITIONS,
  canConfirmCashPayment,
  buildOrderNoticeUrl,
} from "../app/lib/order-policy.ts";

const STATES = [
  "NEW", "CONFIRMED", "PREPARING", "ON_THE_WAY", "DELIVERED", "CANCELLED",
];

test("Every order status has an explicitly defined next-state rule", () => {
  assert.deepEqual(Object.keys(NEXT_STATUSES).sort(), [...STATES].sort());
});

test("Legal status transitions match the order lifecycle", () => {
  assert.deepEqual(NEXT_STATUSES, {
    NEW: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PREPARING", "CANCELLED"],
    PREPARING: ["ON_THE_WAY", "CANCELLED"],
    ON_THE_WAY: ["DELIVERED", "CANCELLED"],
    DELIVERED: [],
    CANCELLED: [],
  });
});

test("Every pair of order statuses is allowed only if in the policy", () => {
  let checked = 0;
  for (const current of STATES) {
    for (const next of STATES) {
      assert.equal(
        canTransitionOrder(current, next),
        NEXT_STATUSES[current].includes(next),
        `${current} → ${next}`
      );
      checked += 1;
    }
  }
  assert.equal(checked, 36);
});

test("Terminal states never transition to another state", () => {
  for (const current of ["DELIVERED", "CANCELLED"]) {
    for (const next of STATES) {
      assert.equal(canTransitionOrder(current, next), false);
    }
  }
});

test("Unknown or malicious status values are rejected", () => {
  for (const bad of [null, undefined, 0, true, [], {}, "__proto__", "toString", "PAID", "new", "NEW ", ""]) {
    assert.equal(isOrderStatus(bad), false);
    assert.equal(canTransitionOrder("NEW", bad), false);
    assert.equal(canTransitionOrder(bad, "CONFIRMED"), false);
  }
});

test("Status validator accepts only declared order statuses", () => {
  for (const state of STATES) assert.equal(isOrderStatus(state), true);
});

test("Cash receipt is confirmed only for delivered, cash, pending orders", () => {
  assert.deepEqual(CASH_PENDING_CONDITIONS, {
    status: "DELIVERED",
    paymentMethod: "CASH",
    paymentStatus: "PENDING",
  });
  assert.equal(canConfirmCashPayment(CASH_PENDING_CONDITIONS), true);
});

test("Cash receipt is rejected for unpaid/paid statuses and other payment methods", () => {
  for (const status of STATES) {
    for (const method of ["CASH", "ONLINE_CARD", "MANUAL_TRANSFER"]) {
      for (const payment of ["PENDING", "AWAITING_VERIFICATION", "PAID", "FAILED", "REFUNDED"]) {
        const shouldAllow = status === "DELIVERED" && method === "CASH" && payment === "PENDING";
        assert.equal(
          canConfirmCashPayment({ status, paymentMethod: method, paymentStatus: payment }),
          shouldAllow,
          `${status}/${method}/${payment}`
        );
      }
    }
  }
});

const validRange = (from, to) =>
  /^\d{4}-\d{2}-\d{2}$/.test(from) &&
  /^\d{4}-\d{2}-\d{2}$/.test(to) &&
  from <= to;

test("Action return URL preserves only validated order filters", () => {
  const url = buildOrderNoticeUrl(
    "/admin/orders?status=NEW&method=CASH&payment=PENDING&q=abc12345&urgent=1&page=2&from=2026-11-01&to=2026-11-03&notice=invalid&evil=yes",
    "confirmed",
    validRange
  );
  const parsed = new URL(url, "https://example.test");
  assert.equal(parsed.pathname, "/admin/orders");
  assert.deepEqual(Object.fromEntries(parsed.searchParams), {
    status: "NEW",
    method: "CASH",
    payment: "PENDING",
    q: "abc12345",
    urgent: "1",
    from: "2026-11-01",
    to: "2026-11-03",
    page: "2",
    notice: "confirmed",
  });
});

test("External, protocol-relative and JavaScript URLs are never followed", () => {
  for (const unsafe of [
    "https://evil.test/admin/orders?status=NEW",
    "//evil.test/admin/orders?status=NEW",
    "javascript:alert(1)",
    "/admin/orders/../../outside",
    "/superadmin?status=NEW",
    "/admin/orders/print?status=NEW",
    "https://qr-menu-actions.invalid.evil.test/admin/orders?status=NEW",
    "a".repeat(1025),
    null,
    {},
  ]) {
    assert.equal(buildOrderNoticeUrl(unsafe, "invalid", validRange), "/admin/orders?notice=invalid");
  }
});

test("Invalid status, method, payment, search, date and page are removed", () => {
  const url = buildOrderNoticeUrl(
    "/admin/orders?status=__proto__&method=FREE&payment=INVALID&q=%3Cscript%3E&page=000&from=2026-11-03&to=2026-11-01",
    "stale",
    validRange
  );
  assert.equal(url, "/admin/orders?notice=stale");
});

test("Urgent queue always forces NEW status", () => {
  const parsed = new URL(buildOrderNoticeUrl(
    "/admin/orders?urgent=1&status=DELIVERED", "confirmed", validRange
  ), "https://example.test");
  assert.equal(parsed.searchParams.get("status"), "NEW");
  assert.equal(parsed.searchParams.get("urgent"), "1");
});

test("Cash due queue overrides incompatible parameters and remains after actions", () => {
  const parsed = new URL(buildOrderNoticeUrl(
    "/admin/orders?cashDue=1&urgent=1&status=NEW&method=ONLINE_CARD&payment=PAID&page=3",
    "cash-paid", validRange
  ), "https://example.test");
  assert.equal(parsed.searchParams.get("cashDue"), "1");
  assert.equal(parsed.searchParams.get("urgent"), null);
  assert.equal(parsed.searchParams.get("status"), "DELIVERED");
  assert.equal(parsed.searchParams.get("method"), "CASH");
  assert.equal(parsed.searchParams.get("payment"), "PENDING");
  assert.equal(parsed.searchParams.get("page"), "3");
  assert.equal(parsed.searchParams.get("notice"), "cash-paid");
});

test("Unrecognized date range does not survive redirect validation", () => {
  const url = buildOrderNoticeUrl(
    "/admin/orders?from=2026-02-31&to=2026-03-01&status=NEW",
    "invalid",
    () => false
  );
  assert.equal(url, "/admin/orders?status=NEW&notice=invalid");
});
