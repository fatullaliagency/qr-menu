import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { Prisma, PrismaClient } from "@prisma/client";
import { createOrderTrackingToken } from "../../app/lib/order-tracking-crypto.ts";

const EXPECTED_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/qr_menu_ci";
if (
  process.env.QR_MENU_EPHEMERAL_DB_TEST !== "true" ||
  process.env.DATABASE_URL !== EXPECTED_DATABASE_URL ||
  (process.env.ADMIN_SESSION_SECRET?.length ?? 0) < 32
) {
  throw new Error("Refusing HTTP smoke tests without the disposable CI database and key.");
}

const BASE = "http://127.0.0.1:3197";
const secret = process.env.ADMIN_SESSION_SECRET;

function cookieFor(restaurantId, expiresAt = Date.now() + 3_600_000) {
  const payload = Buffer.from(JSON.stringify({ restaurantId, expiresAt })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return "qr_admin_session=" + payload + "." + signature;
}

async function ready(server, logs) {
  for (let i = 0; i < 160; i++) {
    if (server.exitCode !== null) throw new Error("Next.js server exited: " + logs());
    try {
      const response = await fetch(BASE + "/order/track/invalid/status?t=invalid", {
        signal: AbortSignal.timeout(1200),
      });
      if (response.status === 404) return;
    } catch {
      // Localhost Next.js is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out starting local Next.js server: " + logs());
}

test("Next.js HTTP routes enforce signed tracking and restaurant session isolation", async (t) => {
  const db = new PrismaClient();
  const restaurantIds = [];
  let server;
  let serverLog = "";
  t.after(async () => {
    if (server && server.exitCode === null) server.kill("SIGTERM");
    try {
      if (restaurantIds.length) {
        await db.order.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
        await db.menuItem.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
        await db.category.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
        await db.restaurant.deleteMany({ where: { id: { in: restaurantIds } } });
      }
    } finally {
      await db.$disconnect();
    }
  });

  const suffix = randomUUID();
  const restaurantA = await db.restaurant.create({
    data: { name: "CI Restaurant Alpha " + suffix, slug: "ci-alpha-" + suffix, phone: "0000000000" },
  });
  restaurantIds.push(restaurantA.id);
  const restaurantB = await db.restaurant.create({
    data: { name: "CI Restaurant Beta " + suffix, slug: "ci-beta-" + suffix, phone: "0000000000" },
  });
  restaurantIds.push(restaurantB.id);
  const category = await db.category.create({
    data: { restaurantId: restaurantA.id, name: "CI Meals" },
  });
  await db.menuItem.create({
    data: { restaurantId: restaurantA.id, categoryId: category.id, name: "CI Example Dish", price: 5.75 },
  });
  const orderAId = randomUUID();
  const orderBId = randomUUID();
  const baseOrder = {
    customerName: "CI Test Customer",
    customerPhone: "+994501234567",
    addressText: "Disposable CI Test Address",
    subtotal: new Prisma.Decimal("5.75"),
    total: new Prisma.Decimal("5.75"),
    paymentMethod: "CASH",
    paymentStatus: "PENDING",
    status: "NEW",
  };
  await db.order.create({ data: { ...baseOrder, id: orderAId, restaurantId: restaurantA.id } });
  await db.order.create({ data: { ...baseOrder, id: orderBId, restaurantId: restaurantB.id } });

  server = spawn(process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3197"],
    { env: process.env, stdio: ["ignore", "pipe", "pipe"] }
  );
  for (const stream of [server.stdout, server.stderr]) {
    stream.on("data", (data) => { serverLog = (serverLog + data.toString()).slice(-4000); });
  }
  await ready(server, () => serverLog);

  await t.test("Anonymous customer menu renders its own restaurant", async () => {
    const response = await fetch(BASE + "/" + restaurantA.slug);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /CI Restaurant Alpha/);
    assert.match(html, /CI Example Dish/);
  });

  await t.test("Notification API denies anonymous and expired admin sessions", async () => {
    const anonymous = await fetch(BASE + "/admin/orders/notifications");
    assert.equal(anonymous.status, 401);
    assert.match(anonymous.headers.get("cache-control") ?? "", /no-store/);
    const expired = await fetch(BASE + "/admin/orders/notifications", {
      headers: { Cookie: cookieFor(restaurantA.id, Date.now() - 1000) },
    });
    assert.equal(expired.status, 401);
  });

  await t.test("Signed admin cookie exposes only its own restaurant's notification marker", async () => {
    const getFor = async (id) => {
      const response = await fetch(BASE + "/admin/orders/notifications", {
        headers: { Cookie: cookieFor(id) },
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      assert.match(response.headers.get("vary") ?? "", /(?:^|,)\\s*Cookie(?:,|$)/i);
      const body = await response.json();
      assert.equal(JSON.stringify(body).includes(baseOrder.customerPhone), false);
      return body;
    };
    const alpha = await getFor(restaurantA.id);
    const beta = await getFor(restaurantB.id);
    assert.equal(alpha.scope, restaurantA.id);
    assert.equal(beta.scope, restaurantB.id);
    assert.equal(alpha.newCount, 1);
    assert.equal(beta.newCount, 1);
    assert.equal(alpha.latestOrder.id, orderAId);
    assert.equal(beta.latestOrder.id, orderBId);

    await db.order.update({ where: { id: orderAId }, data: { status: "CONFIRMED" } });
    const afterConfirmation = await getFor(restaurantA.id);
    assert.equal(afterConfirmation.newCount, 0);
    assert.equal(afterConfirmation.latestOrder.id, orderAId);
  });

  await t.test("Order tracking requires the matching signed token and updates live status", async () => {
    const goodToken = createOrderTrackingToken(secret, orderAId);
    const valid = await fetch(BASE + "/order/track/" + orderAId + "/status?t=" + goodToken);
    assert.equal(valid.status, 200);
    assert.match(valid.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(valid.headers.get("referrer-policy"), "no-referrer");
    const status = await valid.json();
    assert.equal(status.status, "CONFIRMED");
    assert.equal(status.paymentMethod, "CASH");
    assert.equal(status.customerPhone, undefined);

    const incorrect = await fetch(BASE + "/order/track/" + orderBId + "/status?t=" + goodToken);
    assert.equal(incorrect.status, 404);
    const missing = await fetch(BASE + "/order/track/" + orderAId + "/status");
    assert.equal(missing.status, 404);
  });
});
