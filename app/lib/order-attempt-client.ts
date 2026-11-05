import {
  canonicalCashOrderDraft,
  isValidOrderAttemptId,
  type CashOrderDraft,
} from "./order-idempotency.ts";

const LIFETIME_MS = 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = "qr-menu:pending-cash-order:";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type CryptoLike = Pick<Crypto, "randomUUID" | "subtle">;

export type PendingCashOrderAttempt = {
  requestId: string;
  fingerprint: string;
  expiresAt: number;
};

function storageKey(slug: string): string {
  return STORAGE_PREFIX + slug;
}

async function fingerprint(draft: CashOrderDraft, cryptoProvider: CryptoLike): Promise<string> {
  const serialized = canonicalCashOrderDraft(draft);
  const digest = await cryptoProvider.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function usable(
  value: unknown,
  digest: string,
  now: number
): value is PendingCashOrderAttempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Partial<PendingCashOrderAttempt>;
  return isValidOrderAttemptId(attempt.requestId) &&
    attempt.fingerprint === digest &&
    typeof attempt.expiresAt === "number" &&
    attempt.expiresAt > now &&
    attempt.expiresAt <= now + LIFETIME_MS;
}

/**
 * Persists only a one-way payload digest and a random request ID (no plain
 * customer address/phone). Survives a reload after the server committed but
 * the response was lost, yet rotates when the order content changes.
 */
export async function prepareCashOrderAttempt(
  draft: CashOrderDraft,
  storage: StorageLike | null,
  cryptoProvider: CryptoLike,
  fallback: PendingCashOrderAttempt | null = null,
  now: number = Date.now()
): Promise<PendingCashOrderAttempt> {
  const digest = await fingerprint(draft, cryptoProvider);
  if (usable(fallback, digest, now)) return fallback;

  try {
    const json = storage?.getItem(storageKey(draft.slug));
    if (json) {
      const saved: unknown = JSON.parse(json);
      if (usable(saved, digest, now)) return saved;
    }
  } catch {
    // Private browsing/storage restrictions must not prevent a checkout.
  }

  const requestId = cryptoProvider.randomUUID();
  if (!isValidOrderAttemptId(requestId)) {
    throw new Error("Təhlükəsiz sifariş identifikatoru yaradıla bilmədi.");
  }
  const attempt = { requestId, fingerprint: digest, expiresAt: now + LIFETIME_MS };
  try {
    storage?.setItem(storageKey(draft.slug), JSON.stringify(attempt));
  } catch {
    // The caller keeps an in-memory fallback for same-page retries.
  }
  return attempt;
}

export function clearCashOrderAttempt(
  slug: string,
  requestId: string,
  storage: StorageLike | null
): void {
  try {
    const json = storage?.getItem(storageKey(slug));
    if (!json) return;
    const saved: unknown = JSON.parse(json);
    if (
      saved &&
      typeof saved === "object" &&
      (saved as { requestId?: unknown }).requestId === requestId
    ) storage?.removeItem(storageKey(slug));
  } catch {
    // Navigation to the successful tracking URL is still safe.
  }
}
