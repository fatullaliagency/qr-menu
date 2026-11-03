/** Customer tracking should poll only when in the foreground and online.
 * An in-flight request and a permanently invalid link block duplicate work.
 */
export function shouldPollCustomerStatus(
  visible: boolean,
  online: boolean,
  pending: boolean,
  invalidLink: boolean
): boolean {
  return visible === true && online === true &&
    pending === false && invalidLink === false;
}
