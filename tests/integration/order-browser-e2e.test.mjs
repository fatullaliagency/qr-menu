import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

const EXPECTED_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/qr_menu_ci";
if (
  process.env.QR_MENU_EPHEMERAL_DB_TEST !== "true" ||
  process.env.DATABASE_URL !== EXPECTED_DATABASE_URL ||
  process.env.ENABLE_WEB_ORDERS !== "true" ||
  (process.env.ADMIN_SESSION_SECRET?.length ?? 0) < 32
) {
  throw new Error("Browser E2E is restricted to the disposable GitHub CI PostgreSQL database.");
}

const BASE = "http://127.0.0.1:3198";
const scrypt = promisify(scryptCallback);

async function pinHash(pin) {
  const salt = randomBytes(16);
  const key = await scrypt(pin, salt, 64);
  return "scrypt$v1$" + salt.toString("hex") + "$" + key.toString("hex");
}

async function waitUntilReady(proc, logs) {
  for (let attempt = 0; attempt < 160; attempt++) {
    if (proc.exitCode !== null) throw new Error("Next.js process exited: " + logs());
    try {
      const response = await fetch(BASE + "/order/track/invalid/status?t=invalid", {
        signal: AbortSignal.timeout(1200),
      });
      if (response.status === 404) return;
    } catch {
      // The local production build is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Local Next.js startup timeout: " + logs());
}

test("Chromium real browser: new order, PIN access, admin notification, tracking and tenant isolation", {
  timeout: 180_000,
}, async (t) => {
  const db = new PrismaClient();
  const ids = [];
  let server;
  let browser;
  let output = "";
  t.after(async () => {
    if (browser) await browser.close();
    if (server && server.exitCode === null) server.kill("SIGTERM");
    try {
      if (ids.length) {
        await db.order.deleteMany({ where: { restaurantId: { in: ids } } });
        await db.menuItem.deleteMany({ where: { restaurantId: { in: ids } } });
        await db.category.deleteMany({ where: { restaurantId: { in: ids } } });
        await db.restaurant.deleteMany({ where: { id: { in: ids } } });
      }
    } finally {
      await db.$disconnect();
    }
  });

  const suffix = randomUUID();
  const pinA = "653219";
  const pinB = "764218";
  const restaurantA = await db.restaurant.create({
    data: {
      name: "CI Browser Restaurant A",
      slug: "browser-a-" + suffix,
      phone: "+994501234567",
      pinCode: await pinHash(pinA),
    },
  });
  ids.push(restaurantA.id);
  const restaurantB = await db.restaurant.create({
    data: {
      name: "CI Browser Restaurant B",
      slug: "browser-b-" + suffix,
      phone: "+994501234567",
      pinCode: await pinHash(pinB),
    },
  });
  ids.push(restaurantB.id);
  const category = await db.category.create({
    data: { restaurantId: restaurantA.id, name: "CI Browser Meals" },
  });
  const item = await db.menuItem.create({
    data: {
      restaurantId: restaurantA.id,
      categoryId: category.id,
      name: "CI Browser Test Dish",
      description: "Disposable menu product for E2E testing",
      price: 7.45,
    },
  });

  server = spawn(process.execPath, [
    "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3198",
  ], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  for (const stream of [server.stdout, server.stderr]) {
    stream.on("data", (bytes) => { output = (output + bytes.toString()).slice(-4000); });
  }
  await waitUntilReady(server, () => output);
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

  // x-vercel-forwarded-for is injected ONLY by this localhost CI browser,
  // matching the trusted header the production Vercel infrastructure supplies.
  const testHeader = { "x-vercel-forwarded-for": "127.0.0.1" };
  const adminContext = await browser.newContext({
    extraHTTPHeaders: testHeader,
    permissions: ["notifications"],
  });
  const admin = await adminContext.newPage();

  await t.test("A real PIN login opens the first restaurant's protected dashboard", async () => {
    await admin.goto(BASE + "/admin?slug=" + restaurantA.slug);
    await admin.getByRole("textbox", { name: "Admin PİN kodu" }).fill(pinA).catch(async () => {
      await admin.locator('input[type="password"]').fill(pinA);
    });
    await admin.getByRole("button", { name: /Daxil Ol/ }).click();
    await admin.getByRole("link", { name: /Sifarişlər/ }).waitFor({ timeout: 25_000 });
    await admin.goto(BASE + "/admin/orders");
    await admin.getByRole("heading", { name: /Yeni sifarişlər: 0/ }).waitFor({ timeout: 20_000 });
    assert.match(await admin.locator("h1").first().innerText(), /CI Browser Restaurant A/);
    await admin.getByRole("button", { name: /Bildirişi aktiv et/ }).click();
    await admin.getByRole("button", { name: /Bildirişi söndür/ }).waitFor();
  });

  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();
  let orderId;

  await t.test("Customer checkout creates one cash order and opens the tracking page", async () => {
    await customer.goto(BASE + "/" + restaurantA.slug);
    await customer.getByRole("button", {
      name: "CI Browser Test Dish — səbətə əlavə et",
    }).click();
    await customer.getByRole("button", { name: "Sifariş ver →", exact: true }).click();
    await customer.locator('input[name="customerName"]').fill("CI Browser Customer");
    await customer.locator('input[name="customerPhone"]').fill("+994501234567");
    await customer.locator('textarea[name="addressText"]').fill("CI Browser Test Street 15");
    await customer.getByRole("button", { name: /Nağd sifarişi göndər/ }).click();
    await customer.waitForURL(/\/order\/track\/[^/]+\?t=[a-f0-9]{64}/, { timeout: 30_000 });
    const match = customer.url().match(/\/order\/track\/([^?]+)/);
    assert.ok(match, "Order tracking URL must contain an order ID");
    orderId = decodeURIComponent(match[1]);
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    assert.equal(order?.restaurantId, restaurantA.id);
    assert.equal(order?.paymentMethod, "CASH");
    assert.equal(order?.paymentStatus, "PENDING");
    assert.equal(order?.items.length, 1);
    assert.equal(order?.items[0].menuItemId, item.id);
    assert.equal(order?.items[0].quantity, 1);
    assert.equal(order?.total.toString(), "7.45");
    assert.equal(await db.order.count({ where: { id: orderId } }), 1);
  });

  await t.test("Admin notification detects the new order without reloading manually", async () => {
    await admin.getByRole("heading", { name: /Yeni sifarişlər: 1/ }).waitFor({ timeout: 30_000 });
    await admin.getByText(/Yeni sifariş gəldi! Son bildiriş:/).waitFor({ timeout: 30_000 });
    await admin.getByRole("heading", { name: "Sifariş #" + orderId.slice(-8) })
      .waitFor({ timeout: 20_000 });
  });

  await t.test("Restaurant confirmation reaches customer tracking screen", async () => {
    const article = admin.locator("article").filter({
      has: admin.getByRole("heading", { name: "Sifariş #" + orderId.slice(-8) }),
    });
    await article.getByRole("button", { name: /Sifarişi təsdiqlə/ }).click();
    // The success notice also contains a dismiss link. Its whole element's
    // text is not an exact match for the standalone notice string.
    try {
      await admin.getByRole("status").filter({ hasText: "Sifariş təsdiqləndi." })
        .waitFor({ timeout: 25_000 });
    } catch (error) {
      const actual = await db.order.findUnique({
        where: { id: orderId }, select: { status: true },
      });
      throw new Error(
        "Confirmation notice missing; DB status=" + actual?.status +
        " browser URL=" + admin.url() + "; " + String(error)
      );
    }
    const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
    assert.equal(order?.status, "CONFIRMED");
    await customer.locator("p.font-semibold").filter({ hasText: "Təsdiqləndi" })
      .waitFor({ timeout: 30_000 });
  });

  await t.test("Second restaurant cannot see the first restaurant's customer order", async () => {
    const secondContext = await browser.newContext({ extraHTTPHeaders: testHeader });
    const second = await secondContext.newPage();
    try {
      await second.goto(BASE + "/admin?slug=" + restaurantB.slug);
      await second.locator('input[type="password"]').fill(pinB);
      await second.getByRole("button", { name: /Daxil Ol/ }).click();
      await second.getByRole("link", { name: /Sifarişlər/ }).waitFor({ timeout: 25_000 });
      await second.goto(BASE + "/admin/orders");
      await second.getByRole("heading", { name: /Yeni sifarişlər: 0/ }).waitFor({ timeout: 20_000 });
      assert.equal(await second.getByRole("heading", {
        name: "Sifariş #" + orderId.slice(-8),
      }).count(), 0);
      assert.equal(await db.order.count({ where: { restaurantId: restaurantB.id } }), 0);
    } finally {
      await secondContext.close();
    }
  });
});
