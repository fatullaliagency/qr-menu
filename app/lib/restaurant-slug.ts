/**
 * Turns restaurant display names into stable URLs under one shared domain.
 * URLs never change if the restaurant is later renamed.
 */
const RESERVED = new Set([
  "admin", "superadmin", "api", "order", "login", "logout",
  "404", "500", "next", "favicon", "robots", "sitemap", "manifest",
  "static", "restaurants", "restaurant", "new", "search", "privacy",
  "terms", "contact", "about", "pricing", "menu", "menyular",
]);

const AZ_LETTERS: Record<string, string> = {
  "ə": "e", "ı": "i", "ğ": "g", "ş": "s",
  "ç": "c", "ö": "o", "ü": "u",
};

export function restaurantSlugFromName(name: string, attempt = 1): string {
  if (!Number.isSafeInteger(attempt) || attempt < 1 || attempt > 1000) {
    throw new Error("Invalid slug attempt");
  }
  let base = name.trim().toLocaleLowerCase("az-AZ")
    .replace(/[əığşçöü]/g, (letter) => AZ_LETTERS[letter] ?? letter)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length < 3) base = base ? base + "-restoran" : "restoran";
  if (RESERVED.has(base)) base += "-restoran";
  const suffix = attempt === 1 ? "" : "-" + attempt;
  return base.slice(0, 40 - suffix.length).replace(/-+$/g, "") + suffix;
}

function isUniqueSlugConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null ||
      !("code" in error) || error.code !== "P2002") return false;
  if (!("meta" in error) || !error.meta || typeof error.meta !== "object" ||
      !("target" in error.meta)) return true;
  const target = error.meta.target;
  if (Array.isArray(target)) return target.includes("slug");
  return typeof target === "string" && target.includes("slug");
}

/**
 * Database unique constraint is the final authority (safe against two
 * simultaneous creations with the same name); retries with -2, -3, etc.
 */
export async function createWithRestaurantSlug(
  name: string, save: (slug: string) => Promise<unknown>
): Promise<string> {
  for (let attempt = 1; attempt <= 100; attempt++) {
    const slug = restaurantSlugFromName(name, attempt);
    try {
      await save(slug);
      return slug;
    } catch (error) {
      if (!isUniqueSlugConflict(error)) throw error;
    }
  }
  throw new Error("Restoran üçün unikal menyu ünvanı yaratmaq mümkün olmadı.");
}
