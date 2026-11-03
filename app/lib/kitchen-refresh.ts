/**
 * Pure refresh rule used in the kitchen UI and tests. Offline, background,
 * and paused screens must not schedule automatic router.refresh() calls.
 */
export function shouldKitchenAutoRefresh(
  enabled: boolean,
  visible: boolean,
  online: boolean
): boolean {
  return enabled === true && visible === true && online === true;
}
