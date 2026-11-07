import test from "node:test";
import assert from "node:assert/strict";
import {
  isFulfillmentType,
  orderDestinationLabel,
  validateOrderDestination,
} from "../app/lib/fulfillment.ts";
import {
  canonicalCashOrderDraft, isMatchingCashOrder,
} from "../app/lib/order-idempotency.ts";

const settings = {
  tableCount: 12, dineInEnabled: true, deliveryEnabled: true, pickupEnabled: true,
};

test("One restaurant QR supports three explicitly distinct destinations", () => {
  assert.equal(isFulfillmentType("DINE_IN"), true);
  assert.equal(isFulfillmentType("DELIVERY"), true);
  assert.equal(isFulfillmentType("PICKUP"), true);
  assert.equal(isFulfillmentType("OTHER"), false);
  assert.equal(orderDestinationLabel("DINE_IN", 7), "Masa 7");
  assert.equal(orderDestinationLabel("DELIVERY", null), "Çatdırılma");
  assert.equal(orderDestinationLabel("PICKUP", null), "Al-apar");
});

test("Dine-in only accepts enabled, in-range restaurant tables and no address", () => {
  assert.equal(validateOrderDestination("DINE_IN", 7, "", settings), null);
  for (const bad of [null, undefined, 0, -1, 13, 1.5, "7", Number.NaN]) {
    assert.notEqual(validateOrderDestination("DINE_IN", bad, "", settings), null);
  }
  assert.notEqual(validateOrderDestination("DINE_IN", 7, "Street 2", settings), null);
  assert.notEqual(validateOrderDestination("DINE_IN", 7, "", { ...settings, dineInEnabled: false }), null);
  assert.notEqual(validateOrderDestination("DINE_IN", 7, "", { ...settings, tableCount: 4 }), null);
});

test("Delivery requires address, while pickup rejects address and any table", () => {
  assert.equal(validateOrderDestination("DELIVERY", null, "Baku Street 5", settings), null);
  assert.notEqual(validateOrderDestination("DELIVERY", null, "", settings), null);
  assert.notEqual(validateOrderDestination("DELIVERY", null, "Short", settings), null);
  assert.notEqual(validateOrderDestination("DELIVERY", 1, "Baku Street 5", settings), null);
  assert.equal(validateOrderDestination("PICKUP", null, "", settings), null);
  assert.notEqual(validateOrderDestination("PICKUP", 1, "", settings), null);
  assert.notEqual(validateOrderDestination("PICKUP", null, "Baku Street 5", settings), null);
  assert.notEqual(validateOrderDestination("PICKUP", null, "", { ...settings, pickupEnabled: false }), null);
  assert.notEqual(validateOrderDestination("DELIVERY", null, "Baku Street 5", { ...settings, deliveryEnabled: false }), null);
  assert.notEqual(validateOrderDestination("__proto__", null, "", settings), null);
});

const base = {
  slug: "test-restaurant", customerName: "Test Guest", customerPhone: "+994501234567",
  addressText: "", customerNote: "", items: [{ itemId: "item-identifier", quantity: 1 }],
};
const stored = {
  restaurantId: "restaurant-a", customerName: "Test Guest", customerPhone: "+994501234567",
  fulfillmentType: "DINE_IN", tableNumber: 7, addressText: null, customerNote: null,
  items: [{ menuItemId: "item-identifier", quantity: 1 }],
};
test("Idempotency request key changes when type/table changes; another table cannot replay", () => {
  const dine = { ...base, fulfillmentType: "DINE_IN", tableNumber: 7 };
  assert.equal(isMatchingCashOrder(stored, "restaurant-a", dine), true);
  assert.equal(isMatchingCashOrder(stored, "restaurant-b", dine), false);
  assert.equal(isMatchingCashOrder(stored, "restaurant-a", { ...dine, tableNumber: 8 }), false);
  assert.equal(isMatchingCashOrder(stored, "restaurant-a", { ...dine, fulfillmentType: "PICKUP", tableNumber: null }), false);
  assert.notEqual(canonicalCashOrderDraft(dine), canonicalCashOrderDraft({ ...dine, tableNumber: 8 }));
  assert.notEqual(canonicalCashOrderDraft(dine), canonicalCashOrderDraft({ ...dine, fulfillmentType: "PICKUP", tableNumber: null }));
});
