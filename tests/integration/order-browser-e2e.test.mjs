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
    // Customer tracking deliberately pauses polling in hidden browser tabs.
    // Foreground the customer page after the restaurant admin action, just as
    // a customer returning to their tracking page would do.
    await customer.bringToFront();
    const apiStatus = await customer.evaluate(async () => {
      const result = await fetch(window.location.pathname + "/status" + window.location.search);
      return { statusCode: result.status, body: await result.json() };
    });
    assert.equal(apiStatus.statusCode, 200);
    assert.equal(apiStatus.body.status, "CONFIRMED");
    try {
      await customer.locator("p.font-semibold").filter({ hasText: "Restoran təsdiqlədi" })
        .waitFor({ timeout: 20_000 });
    } catch (error) {
      const state = await customer.evaluate(() => document.visibilityState);
      throw new Error(
        "Customer tracking UI stayed stale with visibility=" + state +
        ", serverStatus=" + apiStatus.body.status + "; " + String(error)
      );
    }
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
  await t.test("Mobile checkout stays usable and a lost server response cannot duplicate an order", async () => {
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobile = await mobileContext.newPage();
    try {
      await mobile.goto(BASE + "/" + restaurantA.slug);
      await mobile.getByRole("button", {
        name: "CI Browser Test Dish — səbətə əlavə et",
      }).click();
      await mobile.getByRole("button", {
        name: "Sifariş ver →", exact: true,
      }).click();

      await mobile.locator('input[name="customerName"]').fill("CI Mobile Retry Customer");
      await mobile.locator('input[name="customerPhone"]').fill("+994501234568");
      await mobile.locator('textarea[name="addressText"]').fill("CI Mobile Retry Street 15");

      // Check at a phone-sized viewport, including the checkout dialog.
      const layout = await mobile.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        submitVisible: (() => {
          const button = document.querySelector('button[type="submit"]');
          if (!button) return false;
          const rect = button.getBoundingClientRect();
          return rect.width > 0 && rect.left >= -1 && rect.right <= innerWidth + 1;
        })(),
      }));
      assert.equal(layout.viewport, 390);
      assert.ok(layout.scrollWidth <= layout.viewport + 1,
        "Mobile page must not require horizontal scrolling: " + JSON.stringify(layout));
      assert.equal(layout.submitVisible, true);

      // Intercept ONLY the first Next.js Server Action POST. route.fetch()
      // lets the real server create the order; abort() then deliberately
      // discards the successful response before the browser receives it.
      let actionCount = 0;
      let committedRequest = false;
      await mobile.route(BASE + "/" + restaurantA.slug, async (route) => {
        if (route.request().method() !== "POST" || actionCount > 0) {
          await route.continue();
          return;
        }
        actionCount++;
        const response = await route.fetch();
        committedRequest = response.ok();
        await route.abort("failed");
      });

      await mobile.getByRole("button", { name: /Nağd sifarişi göndər/ }).click();
      await mobile.getByRole("alert").filter({
        hasText: "Sifariş göndərilmədi.",
      }).waitFor({ timeout: 30_000 });

      assert.equal(actionCount, 1, "First submit must send exactly one Server Action");
      assert.equal(committedRequest, true, "The server must have accepted the dropped-response request");

      const created = await db.order.findMany({
        where: {
          restaurantId: restaurantA.id,
          customerName: "CI Mobile Retry Customer",
        },
        select: { id: true, paymentMethod: true, items: { select: { quantity: true } } },
      });
      assert.equal(created.length, 1, "The first request must actually persist exactly one order");
      assert.equal(created[0].paymentMethod, "CASH");
      assert.equal(created[0].items.length, 1);

      const pendingKey = await mobile.evaluate((slug) => {
        const raw = sessionStorage.getItem("qr-menu:pending-cash-order:" + slug);
        return raw ? JSON.parse(raw).requestId : null;
      }, restaurantA.slug);
      assert.equal(pendingKey, created[0].id, "Retry must reuse the persisted idempotency key");

      // The second click must recover the existing order and its original
      // tracking URL rather than inserting another Order or OrderItem.
      await mobile.getByRole("button", { name: /Nağd sifarişi göndər/ }).click();
      await mobile.waitForURL(/\/order\/track\/[^/]+\?t=[a-f0-9]{64}/, {
        timeout: 30_000,
      });
      assert.equal(
        decodeURIComponent(mobile.url().match(/\/order\/track\/([^?]+)/)?.[1] ?? ""),
        created[0].id,
      );
      assert.equal(await db.order.count({
        where: { restaurantId: restaurantA.id, customerName: "CI Mobile Retry Customer" },
      }), 1);
      assert.equal(await db.orderItem.count({ where: { orderId: created[0].id } }), 1);
    } finally {
      await mobileContext.close();
    }
  });

  await t.test("Mobile breakpoint layout and checkout controls", async (t) => {
    const sizes = [
      { width: 320, height: 568 },
      { width: 360, height: 740 },
      { width: 375, height: 667 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
    ];
    for (const size of sizes) {
      await t.test(size.width + "px viewport: menu, cart, checkout and inputs fit", async () => {
        const context = await browser.newContext({
          viewport: size,
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        });
        const page = await context.newPage();
        try {
          await page.goto(BASE + "/" + restaurantA.slug);
          await page.getByRole("heading", { name: "— MENYU —" }).waitFor();
          await page.getByRole("button", {
            name: "CI Browser Test Dish — səbətə əlavə et",
          }).click();
          const orderButton = page.getByRole("button", {
            name: "Sifariş ver →", exact: true,
          });
          await orderButton.click();

          const dialog = page.getByRole("dialog", { name: "Sifarişi təsdiqlə" });
          await dialog.waitFor();
          const customerName = dialog.locator('input[name="customerName"]');
          const phone = dialog.locator('input[name="customerPhone"]');
          const address = dialog.locator('textarea[name="addressText"]');
          await customerName.fill("Mobile CI Test");
          await phone.fill("+994501234569");
          await address.fill("CI Test Street 20");

          const stats = await page.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]');
            const select = (selector) => dialog?.querySelector(selector);
            const inputs = [
              select('input[name="customerName"]'),
              select('input[name="customerPhone"]'),
              select('textarea[name="addressText"]'),
              select('textarea[name="customerNote"]'),
              select('button[type="submit"]'),
            ];
            const available = document.documentElement.clientWidth;
            const rect = (element) => {
              if (!element) return null;
              const box = element.getBoundingClientRect();
              return {
                left: Math.round(box.left),
                right: Math.round(box.right),
                width: Math.round(box.width),
                height: Math.round(box.height),
              };
            };
            return {
              available,
              pageScrollWidth: document.documentElement.scrollWidth,
              bodyScrollWidth: document.body.scrollWidth,
              dialog: rect(dialog),
              controls: inputs.map(rect),
            };
          });

          assert.equal(stats.available, size.width);
          assert.ok(stats.pageScrollWidth <= size.width + 1,
            size.width + "px: document overflow " + JSON.stringify(stats));
          assert.ok(stats.bodyScrollWidth <= size.width + 1,
            size.width + "px: body overflow " + JSON.stringify(stats));
          assert.ok(stats.dialog && stats.dialog.left >= -1 &&
            stats.dialog.right <= size.width + 1,
            size.width + "px: checkout dialog is clipped " + JSON.stringify(stats));
          assert.equal(stats.controls.length, 5);
          for (const control of stats.controls) {
            assert.ok(control && control.width >= 100 && control.height >= 24 &&
              control.left >= -1 && control.right <= size.width + 1,
              size.width + "px: checkout input is clipped " + JSON.stringify(stats));
          }
          assert.equal(await dialog.locator('input[name="customerName"]').inputValue(),
            "Mobile CI Test");
          assert.equal(await dialog.locator('textarea[name="addressText"]').inputValue(),
            "CI Test Street 20");

          // Dismiss checkout without writing anything to PostgreSQL.
          await dialog.getByRole("button", { name: "Bağla" }).click();
          await dialog.waitFor({ state: "hidden" });
          assert.equal(await db.order.count({
            where: { restaurantId: restaurantA.id, customerName: "Mobile CI Test" },
          }), 0);
        } finally {
          await context.close();
        }
      });
    }
  });
});
