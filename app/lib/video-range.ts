export type ByteRange = { start: number; end: number };

/** RFC 7233 single-byte-range support for browser playback and seeking. */
export function parseVideoRange(range: string | null, size: number): ByteRange | null | "invalid" {
  if (!range) return null;
  if (!Number.isSafeInteger(size) || size <= 0) return "invalid";
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return "invalid";
  const [, startText, endText] = match;
  if (!startText) {
    const count = Number(endText);
    if (!Number.isSafeInteger(count) || count <= 0) return "invalid";
    return { start: Math.max(size - count, 0), end: size - 1 };
  }
  const start = Number(startText);
  const end = endText ? Number(endText) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
    start >= size || end < start) return "invalid";
  return { start, end: Math.min(end, size - 1) };
}
