import test from "node:test";
import assert from "node:assert/strict";
import { restaurantSlugFromName, createWithRestaurantSlug } from "../app/lib/restaurant-slug.ts";

test("Azerbaijani restaurant names become stable menus.az paths", () => {
  assert.equal(restaurantSlugFromName("Qoşa Samovar"), "qosa-samovar");
  assert.equal(restaurantSlugFromName("Test Restoranı"), "test-restorani");
  assert.equal(restaurantSlugFromName("Şəki Ət & Çay"), "seki-et-cay");
  assert.equal(restaurantSlugFromName("İstanbul Çörək"), "istanbul-corek");
  assert.equal(restaurantSlugFromName("Café 24"), "cafe-24");
  assert.equal(restaurantSlugFromName("Admin"), "admin-restoran");
  assert.equal(restaurantSlugFromName("!😃!"), "restoran");
  assert.equal(restaurantSlugFromName("Çİ"), "ci-restoran");
});

test("generated slug is unique, short, and deterministic", () => {
  assert.equal(restaurantSlugFromName("Qoşa Samovar", 2), "qosa-samovar-2");
  assert.equal(restaurantSlugFromName("Test Restoranı", 3), "test-restorani-3");
  assert.equal(restaurantSlugFromName("A".repeat(140), 2).length, 40);
  assert.match(restaurantSlugFromName("A".repeat(140), 2), /-2$/);
  assert.throws(() => restaurantSlugFromName("Test", 0));
  assert.throws(() => restaurantSlugFromName("Test", 1001));
});

test("create retries only slug-unique collisions, preserving existing URLs", async () => {
  const created = [];
  const slug = await createWithRestaurantSlug("Qoşa Samovar", async (candidate) => {
    if (candidate === "qosa-samovar") {
      throw { code: "P2002", meta: { target: ["slug"] } };
    }
    created.push(candidate);
  });
  assert.equal(slug, "qosa-samovar-2");
  assert.deepEqual(created, ["qosa-samovar-2"]);
  await assert.rejects(() =>
    createWithRestaurantSlug("Test", async () => {
      throw { code: "P2002", meta: { target: ["phone"] } };
    })
  );
});
