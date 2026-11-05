import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  isValidOrderAttemptId,
  isMatchingCashOrder,
  canonicalCashOrderDraft,
} from "../app/lib/order-idempotency.ts";
import {
  prepareCashOrderAttempt,
  clearCashOrderAttempt,
} from "../app/lib/order-attempt-client.ts";

const ids = [
  "5d5d3491-d325-4d54-a48b-a6e77f4b4a11",
  "dc00e3c5-a87c-4c52-94be-83ed51202ca2",
  "73b776ea-e47d-42a4-9e4e-8c31fd48ab61",
];
const cryptoProvider = {
  subtle: webcrypto.subtle,
  randomUUID: () => ids.shift() ?? "89a304f1-b512-4a15-aa84-d5b8e695d888",
};
const sample = () => ({
  slug: "sample-restaurant",
  customerName: "  Test User ",
  customerPhone: "+994 50 123 45 67",
  addressText: " Baku Test Street 5 ",
  customerNote: "",
  items: [
    { itemId: "product-b", quantity: 2 },
    { itemId: "product-a", quantity: 1 },
  ],
});
const stored = () => ({
  restaurantId: "restaurant-1",
  customerName: "Test User",
  customerPhone: "+994 50 123 45 67",
  addressText: "Baku Test Street 5",
  customerNote: null,
  items: [
    { menuItemId: "product-a", quantity: 1 },
    { menuItemId: "product-b", quantity: 2 },
  ],
});
const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
    size: () => data.size,
    dump: () => [...data.values()].join(""),
  };
};

test("Only strictly formatted random version-4 UUID order IDs are accepted", () => {
  assert.equal(isValidOrderAttemptId(ids[0]), true);
  for (const bad of ["", "123", "abc".repeat(12), "../other-order", "5d5d3491-d325-1d54-a48b-a6e77f4b4a11", null]) {
    assert.equal(isValidOrderAttemptId(bad), false);
  }
});

test("Canonical fingerprint is stable across item order and cosmetic whitespace", () => {
  const draft = sample();
  assert.equal(canonicalCashOrderDraft(draft),
    canonicalCashOrderDraft({ ...draft, customerName: "Test User", items: [...draft.items].reverse() }));
});

test("An unchanged request only recovers its own restaurant and exact details", () => {
  assert.equal(isMatchingCashOrder(stored(), "restaurant-1", sample()), true);
  assert.equal(isMatchingCashOrder(stored(), "restaurant-2", sample()), false);
  assert.equal(isMatchingCashOrder(stored(), "restaurant-1", { ...sample(), customerPhone: "0000000" }), false);
  assert.equal(isMatchingCashOrder(stored(), "restaurant-1", { ...sample(), items: [{ itemId: "product-b", quantity: 3 }, { itemId: "product-a", quantity: 1 }] }), false);
  assert.equal(isMatchingCashOrder(stored(), "restaurant-1", { ...sample(), customerNote: "Different" }), false);
});

test("Reload with the same customer/cart data reuses the same pending order key", async () => {
  const storage = memoryStorage();
  const draft = sample();
  const first = await prepareCashOrderAttempt(draft, storage, cryptoProvider, null, 10000);
  const second = await prepareCashOrderAttempt(draft, storage, cryptoProvider, null, 10010);
  assert.equal(first.requestId, second.requestId);
  assert.equal(storage.size(), 1);
  assert.doesNotMatch(storage.dump(), /Test User|Baku Test Street|994 50/);
});

test("Changed order details rotate the request key and block accidental replay", async () => {
  const storage = memoryStorage();
  const first = await prepareCashOrderAttempt(sample(), storage, cryptoProvider, null, 30000);
  const second = await prepareCashOrderAttempt({ ...sample(), customerNote: "New note" }, storage, cryptoProvider, first, 30001);
  assert.notEqual(first.requestId, second.requestId);
});

test("Expired pending order IDs are never reused", async () => {
  const storage = memoryStorage();
  const first = await prepareCashOrderAttempt(sample(), storage, cryptoProvider, null, 40000);
  const second = await prepareCashOrderAttempt(sample(), storage, cryptoProvider, first, 40000 + 86400001);
  assert.notEqual(first.requestId, second.requestId);
});

test("Successful navigation clears only the correct pending request", async () => {
  const storage = memoryStorage();
  const first = await prepareCashOrderAttempt(sample(), storage, cryptoProvider, null, 70000);
  clearCashOrderAttempt(sample().slug, "someone-else", storage);
  assert.equal(storage.size(), 1);
  clearCashOrderAttempt(sample().slug, first.requestId, storage);
  assert.equal(storage.size(), 0);
});

test("In-memory fallback preserves the same request key if session storage is disabled", async () => {
  const first = await prepareCashOrderAttempt(sample(), null, cryptoProvider, null, 80000);
  const second = await prepareCashOrderAttempt(sample(), null, cryptoProvider, first, 80001);
  assert.equal(first.requestId, second.requestId);
});

test("Server uses Order primary key and recovers uncertain or concurrent writes", () => {
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const action = readFileSync(new URL("../app/[slug]/order-actions.ts", import.meta.url), "utf8");
  assert.match(schema, /model Order \{\s*id String @id @default\(cuid\(\)\)/);
  assert.match(action, /id: requestId,\s*restaurantId: restaurant\.id/);
  assert.match(action, /const previouslyCreated = await replay\(restaurant\.id\)/);
  assert.match(action, /const previouslyCreated = await replay\(validatedRestaurantId\)/);
  assert.match(action, /isMatchingCashOrder\(previous, restaurantId, draft\)/);
});
