import test from "node:test";
import assert from "node:assert/strict";
import { parseEnterpriseFilters, matchesEnterpriseSearch } from "../app/lib/enterprise-filters.ts";

test("superadmin can filter restaurants, hotels or all when hotel module is enabled", () => {
  assert.equal(parseEnterpriseFilters({ type: "restaurant" }, true).type, "restaurant");
  assert.equal(parseEnterpriseFilters({ type: "hotel" }, true).type, "hotel");
  assert.equal(parseEnterpriseFilters({ type: "all" }, true).type, "all");
  assert.equal(parseEnterpriseFilters({ type: "surprise" }, true).type, "all");
  assert.equal(parseEnterpriseFilters({ type: ["hotel", "restaurant"] }, true).type, "all");
});

test("hotel-only filter cannot hide restaurant list while module is disabled", () => {
  assert.equal(parseEnterpriseFilters({ type: "hotel" }, false).type, "all");
  assert.equal(parseEnterpriseFilters({ type: "restaurant" }, false).type, "restaurant");
});

test("search is trimmed, bounded and case-insensitive for name and slug", () => {
  const filters = parseEnterpriseFilters({ q: "  İSTİRAHƏT " }, true);
  assert.equal(filters.search, "İSTİRAHƏT");
  assert.equal(matchesEnterpriseSearch({ name: "İstirahət Oteli", slug: "another" }, filters.normalized), true);
  assert.equal(matchesEnterpriseSearch({ name: "Different", slug: "istirahət-otel" }, filters.normalized), true);
  assert.equal(matchesEnterpriseSearch({ name: "Başqa Otel", slug: "basqa" }, filters.normalized), false);
  assert.equal(parseEnterpriseFilters({ q: "x".repeat(100) }, true).search.length, 80);
  assert.equal(parseEnterpriseFilters({ q: ["otel"] }, true).search, "");
  assert.equal(matchesEnterpriseSearch({ name: "Any", slug: "any" }, ""), true);
});
