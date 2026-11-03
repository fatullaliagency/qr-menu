import test from "node:test";
import assert from "node:assert/strict";

import { KITCHEN_PAGE_SIZE, getKitchenPage } from "../app/lib/kitchen-pagination.ts";

test("Kitchen page size is 30", () => {
  assert.equal(KITCHEN_PAGE_SIZE, 30);
});

test("Kitchen first page is stable for an empty queue", () => {
  assert.deepEqual(getKitchenPage(undefined, 0), {
    page: 1, pageCount: 1, skip: 0, take: 30,
  });
});

test("Kitchen pagination selects the right slice", () => {
  assert.deepEqual(getKitchenPage("2", 100), {
    page: 2, pageCount: 4, skip: 30, take: 30,
  });
  assert.deepEqual(getKitchenPage("4", 100), {
    page: 4, pageCount: 4, skip: 90, take: 30,
  });
});

test("Kitchen page number clamps to last page after an order leaves the queue", () => {
  assert.deepEqual(getKitchenPage("4", 31), {
    page: 2, pageCount: 2, skip: 30, take: 30,
  });
});

test("Kitchen page ignores invalid or malicious values", () => {
  for (const raw of ["0", "-1", "0001", "5.5", "10000", "__proto__", "1&admin=true", null, [], {}, 2]) {
    assert.equal(getKitchenPage(raw, 65).page, 1);
  }
});

test("Kitchen page count handles page-size boundaries", () => {
  assert.equal(getKitchenPage("1", 30).pageCount, 1);
  assert.equal(getKitchenPage("1", 31).pageCount, 2);
  assert.equal(getKitchenPage("1", 60).pageCount, 2);
  assert.equal(getKitchenPage("1", 61).pageCount, 3);
});

test("Invalid count never creates a negative skip", () => {
  assert.equal(getKitchenPage("100", -1).skip, 0);
  assert.equal(getKitchenPage("100", Number.NaN).skip, 0);
});
