import test from "node:test";
import assert from "node:assert/strict";
import { shouldKitchenAutoRefresh } from "../app/lib/kitchen-refresh.ts";

test("Kitchen refresh is allowed only if enabled, visible and online", () => {
  let cases = 0;
  for (const enabled of [false, true]) {
    for (const visible of [false, true]) {
      for (const online of [false, true]) {
        assert.equal(
          shouldKitchenAutoRefresh(enabled, visible, online),
          enabled && visible && online
        );
        cases += 1;
      }
    }
  }
  assert.equal(cases, 8);
});

test("Kitchen refresh does not bypass the paused or offline state", () => {
  assert.equal(shouldKitchenAutoRefresh(false, true, true), false);
  assert.equal(shouldKitchenAutoRefresh(true, false, true), false);
  assert.equal(shouldKitchenAutoRefresh(true, true, false), false);
});
