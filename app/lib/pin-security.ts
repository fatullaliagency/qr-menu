
import "server-only";

import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

const PIN_HASH_PATTERN =
  /^scrypt\$v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/;

export function matchesMasterPin(
  entered: string,
  expected: string | undefined
): boolean {
  if (!expected) return false;

  const enteredHash = createHash("sha256")
    .update(entered, "utf8")
    .digest();

  const expectedHash = createHash("sha256")
    .update(expected, "utf8")
    .digest();

  return timingSafeEqual(enteredHash, expectedHash);
}

export async function hashRestaurantPin(
  pin: string
): Promise<string> {
  if (!/^\d{4,12}$/.test(pin)) {
    throw new Error("PİN 4-12 rəqəmdən ibarət olmalıdır.");
  }

  const salt = randomBytes(16);
  const derivedKey = (await scrypt(
    pin,
    salt,
    KEY_LENGTH
  )) as Buffer;

  return [
    "scrypt",
    "v1",
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join("$");
}

export async function verifyRestaurantPin(
  entered: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (!storedHash) return false;

  const match = PIN_HASH_PATTERN.exec(storedHash);
  if (!match) return false;

  const salt = Buffer.from(match[1], "hex");
  const expectedKey = Buffer.from(match[2], "hex");

  const actualKey = (await scrypt(
    entered,
    salt,
    KEY_LENGTH
  )) as Buffer;

  return timingSafeEqual(actualKey, expectedKey);
}
