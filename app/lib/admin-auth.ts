
import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "qr_admin_session";
const SESSION_DURATION = 60 * 60 * 8;

type AdminSession = {
  restaurantId: string;
  expiresAt: number;
};

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "ADMIN_SESSION_SECRET must contain at least 32 characters."
    );
  }

  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

function verifySignature(
  payload: string,
  signature: string
): boolean {
  const expected = Buffer.from(sign(payload), "base64url");
  const actual = Buffer.from(signature, "base64url");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export async function createAdminSession(
  restaurantId: string
): Promise<void> {
  if (!restaurantId) {
    throw new Error("Restaurant ID is required.");
  }

  const expiresAt =
    Date.now() + SESSION_DURATION * 1000;

  const session: AdminSession = {
    restaurantId,
    expiresAt,
  };

  const payload = Buffer.from(
    JSON.stringify(session)
  ).toString("base64url");

  const signature = sign(payload);

  const cookieStore = await cookies();

  cookieStore.set(
    COOKIE_NAME,
    `${payload}.${signature}`,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION,
    }
  );
}

export async function getAdminSession():
  Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [payload, signature] = parts;

  if (!payload || !signature) {
    return null;
  }

  if (!verifySignature(payload, signature)) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as Partial<AdminSession>;

    if (
      typeof session.restaurantId !== "string" ||
      !session.restaurantId ||
      typeof session.expiresAt !== "number" ||
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }

    return {
      restaurantId: session.restaurantId,
      expiresAt: session.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function requireAdminSession(
  restaurantId: string
): Promise<void> {
  const session = await getAdminSession();

  if (
    !session ||
    session.restaurantId !== restaurantId
  ) {
    throw new Error("İcazəsiz əməliyyat.");
  }
}

export async function deleteAdminSession():
  Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(COOKIE_NAME);
}
