import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectMenuVideo, parseMenuVideoFile, MAX_MENU_VIDEO_BYTES, encodeVideoBlob, decodeVideoBlob, isVideoBlobUrl,
} from "../app/lib/menu-video.ts";
import { parseVideoRange } from "../app/lib/video-range.ts";

const mp4 = Uint8Array.from([
  0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  0, 0, 0, 0, 0, 0, 0, 0,
]);
const webm = Uint8Array.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81,
  0x01, 0x42, 0xf7, 0x81, 0x01,
]);

test("Short MP4 and WebM are accepted, not arbitrary data or disguised files", () => {
  assert.equal(inspectMenuVideo("video/mp4", mp4), null);
  assert.equal(inspectMenuVideo("video/webm", webm), null);
  assert.notEqual(inspectMenuVideo("video/mp4", webm), null);
  assert.notEqual(inspectMenuVideo("video/webm", mp4), null);
  assert.notEqual(inspectMenuVideo("video/quicktime", mp4), null);
  assert.notEqual(inspectMenuVideo("image/png", mp4), null);
  assert.notEqual(inspectMenuVideo("video/mp4", new Uint8Array(11)), null);
  assert.notEqual(inspectMenuVideo("video/mp4", new Uint8Array(MAX_MENU_VIDEO_BYTES + 1)), null);
});

test("Server-side File parsing uses validated bytes, never a user-supplied file path", async () => {
  const file = new File([mp4], "intro.mp4", { type: "video/mp4" });
  const result = await parseMenuVideoFile(file);
  assert.equal(result.mimeType, "video/mp4");
  assert.equal(result.sizeBytes, mp4.length);
  assert.deepEqual([...result.payload], [...mp4]);
  assert.equal(await parseMenuVideoFile(null), null);
  assert.equal(await parseMenuVideoFile(new File([], "", { type: "" })), null);
  assert.equal(await parseMenuVideoFile(new File([], "blob", { type: "application/octet-stream" })), null);
  assert.equal(await parseMenuVideoFile(""), null);
  await assert.rejects(parseMenuVideoFile("data:video/mp4;base64,AAAA"), /Video faylı/);
  await assert.rejects(parseMenuVideoFile(new File([webm], "bad.mp4", { type: "video/mp4" })), /quruluşu/);
});

test("HTTP byte range supports playback, seeking, suffix and invalid ranges", () => {
  assert.equal(parseVideoRange(null, 20), null);
  assert.deepEqual(parseVideoRange("bytes=0-", 20), { start: 0, end: 19 });
  assert.deepEqual(parseVideoRange("bytes=4-9", 20), { start: 4, end: 9 });
  assert.deepEqual(parseVideoRange("bytes=10-5000", 20), { start: 10, end: 19 });
  assert.deepEqual(parseVideoRange("bytes=-4", 20), { start: 16, end: 19 });
  assert.deepEqual(parseVideoRange("bytes=-1000", 20), { start: 0, end: 19 });
  for (const bad of ["bytes=20-", "bytes=9-4", "bytes=0-1,3-4", "bytes=-0", "items=0-", "bytes=-", "bytes=NaN-", "bytes=0-1abc"]) {
    assert.equal(parseVideoRange(bad, 20), "invalid", bad);
  }
});

test("accepts 10 MiB and rejects larger videos", () => {
  assert.equal(MAX_MENU_VIDEO_BYTES, 10485760);
  const valid = new Uint8Array(MAX_MENU_VIDEO_BYTES); valid.set(mp4);
  assert.equal(inspectMenuVideo("video/mp4", valid), null);
  assert.notEqual(inspectMenuVideo("video/mp4", new Uint8Array(MAX_MENU_VIDEO_BYTES + 1)), null);
});
test("Blob references are small and prevent other hosts and tenants", () => {
  const id = "clabcdefgh1234567890";
  const url = "https://abc.public.blob.vercel-storage.com/menu-videos/" + id + "/clip-12345.mp4";
  assert.equal(isVideoBlobUrl(url, id), true);
  assert.equal(isVideoBlobUrl(url, "clother123456789012"), false);
  assert.equal(isVideoBlobUrl("https://evil.example.com/menu-videos/" + id + "/clip.mp4"), false);
  const value = encodeVideoBlob(url, "video/mp4", MAX_MENU_VIDEO_BYTES);
  assert.ok(value.payload.length < 1024);
  assert.equal(decodeVideoBlob(value.payload), url);
  assert.equal(decodeVideoBlob(mp4), null);
  assert.throws(() => encodeVideoBlob(url, "video/mp4", MAX_MENU_VIDEO_BYTES + 1));
});
