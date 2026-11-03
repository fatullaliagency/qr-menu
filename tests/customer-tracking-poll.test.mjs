import test from "node:test";
import assert from "node:assert/strict";
import { shouldPollCustomerStatus } from "../app/lib/customer-tracking-poll.ts";

test("Customer status polling requires foreground, network, no pending request and a valid link", () => {
  let checked = 0;
  for (const visible of [false, true]) {
    for (const online of [false, true]) {
      for (const pending of [false, true]) {
        for (const invalidLink of [false, true]) {
          assert.equal(
            shouldPollCustomerStatus(visible, online, pending, invalidLink),
            visible && online && !pending && !invalidLink
          );
          checked += 1;
        }
      }
    }
  }
  assert.equal(checked, 16);
});

test("Customer polling skips offline, hidden, concurrent or invalid-link cases", () => {
  assert.equal(shouldPollCustomerStatus(false, true, false, false), false);
  assert.equal(shouldPollCustomerStatus(true, false, false, false), false);
  assert.equal(shouldPollCustomerStatus(true, true, true, false), false);
  assert.equal(shouldPollCustomerStatus(true, true, false, true), false);
  assert.equal(shouldPollCustomerStatus(true, true, false, false), true);
});
