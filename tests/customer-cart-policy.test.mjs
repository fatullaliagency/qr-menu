import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addCartItem,
  canAddCartItem,
  MAX_CART_DISTINCT_ITEMS,
  MAX_QUANTITY_PER_ITEM,
} from "../app/lib/cart-policy.ts";

const product = (id) => ({ id, name: "Product " + id });

test("Customer cart matches server-side 30-line and 30-quantity limits", () => {
  assert.equal(MAX_CART_DISTINCT_ITEMS, 30);
  assert.equal(MAX_QUANTITY_PER_ITEM, 30);
  const action = readFileSync(new URL("../app/[slug]/order-actions.ts", import.meta.url), "utf8");
  assert.match(action, /input\.items\.length > 30/);
  assert.match(action, /line\.quantity > 30/);
});

test("New products are added once, repeated products increment without mutation", () => {
  const first = addCartItem([], product("a"));
  const second = addCartItem(first, product("a"));
  assert.equal(first.length, 1);
  assert.equal(first[0].quantity, 1);
  assert.equal(second.length, 1);
  assert.equal(second[0].quantity, 2);
  assert.notEqual(second, first);
});

test("Existing product cannot exceed 30 even after repeated clicks", () => {
  let cart = [];
  for (let i = 0; i < 45; i++) cart = addCartItem(cart, product("a"));
  assert.equal(cart[0].quantity, MAX_QUANTITY_PER_ITEM);
  assert.equal(canAddCartItem(cart, "a"), false);
  assert.equal(addCartItem(cart, product("a")), cart);
});

test("A full distinct-item cart blocks a new item but permits increasing existing items", () => {
  let cart = [];
  for (let i = 0; i < MAX_CART_DISTINCT_ITEMS; i++) {
    cart = addCartItem(cart, product("item-" + i));
  }
  assert.equal(cart.length, 30);
  assert.equal(canAddCartItem(cart, "extra"), false);
  assert.equal(addCartItem(cart, product("extra")), cart);
  const incremented = addCartItem(cart, product("item-0"));
  assert.equal(incremented.length, 30);
  assert.equal(incremented[0].quantity, 2);
});

test("Checkout uses an immediate ref lock to block rapid duplicate submits", () => {
  const component = readFileSync(new URL("../app/[slug]/ClientRestaurantMenu.tsx", import.meta.url), "utf8");
  const begin = component.indexOf("const submitOrder = async");
  const end = component.indexOf("const sendWhatsAppOrder", begin);
  assert.ok(begin >= 0 && end > begin);
  const handler = component.slice(begin, end);
  assert.match(handler, /if \(submittingRef\.current \|\|/);
  assert.match(handler, /submittingRef\.current = true;/);
  assert.match(handler, /if \(!navigating\) \{\s*submittingRef\.current = false;/);
  assert.match(handler, /window\.location\.assign\(result\.url\)/);
  assert.match(component, /disabled=\{!canAddCartItem\(cart, item\.id\)\}/);
});
