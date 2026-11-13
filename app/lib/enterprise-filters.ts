/** Read-only superadmin list filtering. Never use these UI filters for authorization. */
export type EnterpriseType = "all" | "restaurant" | "hotel";
export type EnterpriseQuery = {
  q?: string | string[];
  type?: string | string[];
};

export function parseEnterpriseFilters(
  query: EnterpriseQuery,
  hotelEnabled: boolean
): { search: string; normalized: string; type: EnterpriseType } {
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 80) : "";
  const type: EnterpriseType =
    hotelEnabled && query.type === "hotel"
      ? "hotel"
      : query.type === "restaurant"
        ? "restaurant"
        : "all";
  return { search, normalized: search.toLocaleLowerCase("az-AZ"), type };
}

export function matchesEnterpriseSearch(
  business: { name: string; slug: string },
  normalized: string
): boolean {
  return (
    normalized.length === 0 ||
    business.name.toLocaleLowerCase("az-AZ").includes(normalized) ||
    business.slug.toLocaleLowerCase("az-AZ").includes(normalized)
  );
}
