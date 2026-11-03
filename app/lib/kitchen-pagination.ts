// Pure page policy shared by the kitchen screen and automated tests.
// Pages outside the current range are clamped to the last available page.
export const KITCHEN_PAGE_SIZE = 30;

export function getKitchenPage(raw: unknown, total: number) {
  const safeTotal = Number.isSafeInteger(total) && total >= 0 ? total : 0;
  const pageCount = Math.max(1, Math.ceil(safeTotal / KITCHEN_PAGE_SIZE));
  const requested =
    typeof raw === "string" && /^[1-9][0-9]{0,3}$/.test(raw)
      ? Number(raw)
      : 1;
  const page = Math.min(requested, pageCount);
  return {
    page,
    pageCount,
    skip: (page - 1) * KITCHEN_PAGE_SIZE,
    take: KITCHEN_PAGE_SIZE,
  };
}
