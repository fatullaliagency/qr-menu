import test from "node:test";
import assert from "node:assert/strict";
import { validateDeliveryCoordinates, deliveryMapUrl } from "../app/lib/delivery-location.ts";

test("Delivery supports no map pin for backward compatibility or two real coordinates", () => {
  assert.equal(validateDeliveryCoordinates("DELIVERY", null, null), null);
  assert.equal(validateDeliveryCoordinates("DELIVERY", undefined, undefined), null);
  assert.equal(validateDeliveryCoordinates("DELIVERY", 40.409264, 49.867092), null);
  assert.equal(validateDeliveryCoordinates("DELIVERY", 0, 0), null);
  assert.equal(validateDeliveryCoordinates("DELIVERY", -90, 180), null);
  assert.equal(validateDeliveryCoordinates("DELIVERY", 90, -180), null);
  const url = deliveryMapUrl(40.409264, 49.867092);
  assert.ok(url?.startsWith("https://www.google.com/maps/search/?api=1&query="));
  assert.equal(new URL(url).searchParams.get("query"), "40.409264,49.867092");
  assert.equal(deliveryMapUrl(null, 49.867092), null);
});

test("Coordinates reject partial, string, NaN, Infinity and invalid ranges", () => {
  for (const pair of [
    [40.4, null], [null, 49.8], [40.4, undefined], [undefined, 49.8],
    ["40.4", 49.8], [40.4, "49.8"], [NaN, 49.8],
    [Infinity, 49.8], [40.4, -Infinity], [90.00001, 49.8],
    [40.4, 180.001], [-91, 49.8],
  ]) {
    assert.notEqual(validateDeliveryCoordinates("DELIVERY", ...pair), null);
  }
});

test("Only delivery can store location, including for malicious client submissions", () => {
  for (const type of ["DINE_IN", "PICKUP"]) {
    assert.equal(validateDeliveryCoordinates(type, null, null), null);
    assert.notEqual(validateDeliveryCoordinates(type, 40.4, 49.8), null);
  }
});
