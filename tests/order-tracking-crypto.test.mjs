import test from "node:test";
import assert from "node:assert/strict";
import {
  isTrackingTokenFormatValid,
  createOrderTrackingToken,
  verifyOrderTrackingToken,
} from "../app/lib/order-tracking-crypto.ts";

// Test keys are synthetic. No production/session secrets are loaded.
const TEST_SECRET = "test-only-secret-a".repeat(4);
const OTHER_SECRET = "test-only-secret-b".repeat(4);
const ORDER_A = "clknownorder00001";
const ORDER_B = "clknownorder00002";

test("Tracking tokens are 64 lowercase hex characters", () => {
  const token = createOrderTrackingToken(TEST_SECRET, ORDER_A);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(isTrackingTokenFormatValid(ORDER_A, token), true);
});

test("Valid signature is tied to exactly one order and secret", () => {
  const token = createOrderTrackingToken(TEST_SECRET, ORDER_A);
  assert.equal(verifyOrderTrackingToken(TEST_SECRET, ORDER_A, token), true);
  assert.equal(verifyOrderTrackingToken(TEST_SECRET, ORDER_B, token), false);
  assert.equal(verifyOrderTrackingToken(OTHER_SECRET, ORDER_A, token), false);
});

test("Tracking signatures are deterministic but distinct across order IDs", () => {
  assert.equal(
    createOrderTrackingToken(TEST_SECRET, ORDER_A),
    createOrderTrackingToken(TEST_SECRET, ORDER_A)
  );
  assert.notEqual(
    createOrderTrackingToken(TEST_SECRET, ORDER_A),
    createOrderTrackingToken(TEST_SECRET, ORDER_B)
  );
});

test("Short, oversized and non-string order IDs are rejected before verification", () => {
  const token = createOrderTrackingToken(TEST_SECRET, ORDER_A);
  for (const id of ["", "too-short", "a".repeat(151), null, undefined, [], {}, 42]) {
    assert.equal(isTrackingTokenFormatValid(id, token), false);
    assert.equal(verifyOrderTrackingToken(TEST_SECRET, id, token), false);
  }
});

test("Malformed token values cannot bypass signature checks", () => {
  for (const token of [
    "", "a".repeat(63), "a".repeat(65), "g".repeat(64),
    "A".repeat(64), "<script>", "../".repeat(22), null,
    undefined, 42, {}, [],
  ]) {
    assert.equal(isTrackingTokenFormatValid(ORDER_A, token), false);
    assert.equal(verifyOrderTrackingToken(TEST_SECRET, ORDER_A, token), false);
  }
});

test("A well-formed forged token cannot authorize an order", () => {
  const forged = "0".repeat(64);
  assert.equal(isTrackingTokenFormatValid(ORDER_A, forged), true);
  assert.equal(verifyOrderTrackingToken(TEST_SECRET, ORDER_A, forged), false);
});

test("Single-character tampering invalidates the token", () => {
  const token = createOrderTrackingToken(TEST_SECRET, ORDER_A);
  const tampered = (token[0] === "a" ? "b" : "a") + token.slice(1);
  assert.equal(verifyOrderTrackingToken(TEST_SECRET, ORDER_A, tampered), false);
});
