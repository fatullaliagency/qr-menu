import test from "node:test";
import assert from "node:assert/strict";

import {
  NEXT_STATUSES,
  isOrderStatus,
  canTransitionOrder,
  CASH_PENDING_CONDITIONS,
  canConfirmCashPayment,
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
