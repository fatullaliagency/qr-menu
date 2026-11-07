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
  timeout: 300_000,
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
    assert.equal(order?.latitude, null);
    assert.equal(order?.longitude, null);
    assert.equal(await db.order.count({ where: { id: orderId } }), 1);
  });

  await t.test("Admin notification detects the new order without reloading manually", async () => {
    await admin.getByRole("heading", { name: /Yeni sifarişlər: 1/ }).waitFor({ timeout: 30_000 });
    await admin.getByText(/Yeni sifariş gəldi! Son bildiriş:/).waitFor({ timeout: 30_000 });
    await admin.getByRole("heading", { name: "Sifariş #" + orderId.slice(-8) })
      .waitFor({ timeout: 20_000 });
  });

  await t.test("Courier WhatsApp sharing of a delivery without GPS pin waits for operator click", async () => {
    const article = admin.locator("article").filter({
      has: admin.getByRole("heading", { name: "Sifariş #" + orderId.slice(-8) }),
    });
    await admin.evaluate(() => {
      window.__courierShareLinks = [];
      window.open = (url, target, features) => {
        window.__courierShareLinks.push({ url, target, features });
        return null;
      };
    });
    // No automatic third-party sharing just by viewing the order.
    assert.equal(await admin.evaluate(() => window.__courierShareLinks.length), 0);
    await article.getByRole("button", { name: "Kuryerlə WhatsApp-da paylaş" }).click();
    const shared = await admin.evaluate(() => window.__courierShareLinks.at(-1));
    assert.equal(shared.target, "_blank");
    assert.match(shared.features, /noopener/);
    const url = new URL(shared.url);
    assert.equal(url.hostname, "wa.me");
    assert.equal(url.pathname, "/");
    const message = url.searchParams.get("text");
    assert.ok(message);
    for (const value of [
      restaurantA.name, "CI Browser Customer", "+994501234567",
      "CI Browser Test Street 15", "CI Browser Test Dish", "7.45 ₼",
      "Müştəri xəritədə məkan seçməyib",
    ]) assert.ok(message.includes(value), "WhatsApp delivery message missing " + value);
    assert.doesNotMatch(message, /\/order\/track\/|\?t=[a-f0-9]{64}|qr_admin_auth/);
    assert.ok(!message.includes(restaurantB.name), "Do not share a different restaurant");
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

  await t.test("Notification opt-in, simulated sound, offline recovery and no duplicate alerts", async () => {
    // This instrumented Chromium context verifies browser API calls. No claim
    // is made that a physical phone emitted audible sound or an OS toast.
    const alertsContext = await browser.newContext({
      extraHTTPHeaders: testHeader,
      permissions: ["notifications"],
    });
    await alertsContext.addInitScript(() => {
      const key = "qr-ci:notification-api-calls";
      const record = (kind, details = null) => {
        const counters = JSON.parse(sessionStorage.getItem(key) || '{"tones":0,"notifications":[]}');
        if (kind === "tone") counters.tones += 1;
        if (kind === "notification") counters.notifications.push(details);
        sessionStorage.setItem(key, JSON.stringify(counters));
      };
      class InstrumentedAudioContext {
        currentTime = 0;
        destination = {};
        resume() { return Promise.resolve(); }
        close() { return Promise.resolve(); }
        createOscillator() {
          return {
            type: "sine",
            frequency: {
              setValueAtTime() {},
              linearRampToValueAtTime() {},
            },
            connect() {},
            start() { record("tone"); },
            stop() {},
          };
        }
        createGain() {
          return {
            gain: {
              setValueAtTime() {},
              exponentialRampToValueAtTime() {},
            },
            connect() {},
          };
        }
      }
      class InstrumentedNotification {
        static permission = "granted";
        static requestPermission() { return Promise.resolve("granted"); }
        constructor(title, options = {}) {
          record("notification", { title, body: options.body, tag: options.tag });
          this.onclick = null;
        }
      }
      Object.defineProperty(window, "AudioContext", {
        configurable: true, value: InstrumentedAudioContext,
      });
      Object.defineProperty(window, "Notification", {
        configurable: true, value: InstrumentedNotification,
      });
    });
    const page = await alertsContext.newPage();
    const counters = () => page.evaluate(() => JSON.parse(
      sessionStorage.getItem("qr-ci:notification-api-calls") ||
      '{"tones":0,"notifications":[]}'
    ));
    const createNewOrder = async (label) => db.order.create({
      data: {
        id: randomUUID(),
        restaurantId: restaurantA.id,
        customerName: label,
        customerPhone: "+994501234567",
        addressText: "CI Notification Test Street",
        subtotal: 1.25,
        deliveryFee: 0,
        total: 1.25,
        paymentMethod: "CASH",
        paymentStatus: "PENDING",
        status: "NEW",
      },
    });
    try {
      await page.goto(BASE + "/admin?slug=" + restaurantA.slug);
      await page.locator('input[type="password"]').fill(pinA);
      await page.getByRole("button", { name: /Daxil Ol/ }).click();
      await page.getByRole("link", { name: /Sifarişlər/ }).waitFor({ timeout: 25_000 });
      const initialNewCount = await db.order.count({
        where: { restaurantId: restaurantA.id, status: "NEW" },
      });
      await page.goto(BASE + "/admin/orders");
      await page.getByRole("heading", { name: "Yeni sifarişlər: " + initialNewCount })
        .waitFor({ timeout: 20_000 });

      // First poll establishes a baseline, even though orders already exist.
      assert.deepEqual(await counters(), { tones: 0, notifications: [] });
      await page.getByRole("button", { name: /Bildirişi aktiv et/ }).click();
      await page.getByRole("button", { name: /Bildirişi söndür/ }).waitFor();
      await page.getByText("Səs və brauzer bildirişləri aktivdir.").waitFor();
      assert.deepEqual(await counters(), { tones: 0, notifications: [] });

      // A new order arrives while the browser is disconnected; the server
      // retains it, but the page must not fake a delivered notification.
      await alertsContext.setOffline(true);
      const first = await createNewOrder("CI Offline Alert A");
      await page.waitForTimeout(500);
      assert.deepEqual(await counters(), { tones: 0, notifications: [] });

      await alertsContext.setOffline(false);
      await page.getByRole("heading", { name: "Yeni sifarişlər: " + (initialNewCount + 1) })
        .waitFor({ timeout: 30_000 });
      await page.getByText(/Yeni sifariş gəldi! Son bildiriş:/)
        .waitFor({ timeout: 30_000 });
      await page.waitForFunction(() => {
        const x = JSON.parse(sessionStorage.getItem("qr-ci:notification-api-calls") ||
          '{"tones":0,"notifications":[]}');
        return x.tones === 1 && x.notifications.length === 1;
      }, null, { timeout: 10_000 });

      let result = await counters();
      assert.equal(result.tones, 1, "Exactly one audio oscillator must be started");
      assert.equal(result.notifications.length, 1, "Exactly one OS notification call must occur");
      assert.equal(result.notifications[0].title, "QR Menü — yeni sifariş");
      assert.equal(result.notifications[0].tag, "qr-menu-new-order");
      assert.equal(result.notifications[0].body.includes(first.customerName), false,
        "Notification body must not leak customer details");

      // Re-polling and editing an existing order must not repeat the alert.
      await db.order.update({ where: { id: first.id }, data: { status: "CONFIRMED" } });
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await page.getByRole("heading", { name: "Yeni sifarişlər: " + initialNewCount })
        .waitFor({ timeout: 20_000 });
      assert.deepEqual(await counters(), result);

      // User opt-out disables both OS and audio APIs, but a new order still
      // increments the admin dashboard count.
      await page.getByRole("button", { name: /Bildirişi söndür/ }).click();
      await page.getByRole("button", { name: /Bildirişi aktiv et/ }).waitFor();
      await createNewOrder("CI Muted Alert B");
      await page.getByRole("heading", { name: "Yeni sifarişlər: " + (initialNewCount + 1) })
        .waitFor({ timeout: 30_000 });
      assert.deepEqual(await counters(), result);
    } finally {
      await alertsContext.close();
    }
  });


  await t.test("300 real HTTP Server Action checkouts in bounded parallel batches", {
    timeout: 135_000,
  }, async (t) => {
    // Keep this entire fixture separate from Restaurant A/B. The browser
    // suite cleans A/B, but the disposable CI backup must include all 300
    // written orders so the restore test verifies real load data.
    const loadRestaurant = await db.restaurant.create({
      data: {
        name: "CI HTTP Load Restaurant",
        slug: "ci-load-" + randomUUID(),
        phone: "+994501234567",
      },
    });
    const loadCategory = await db.category.create({
      data: { restaurantId: loadRestaurant.id, name: "CI Load Items" },
    });
    await db.menuItem.create({
      data: {
        restaurantId: loadRestaurant.id,
        categoryId: loadCategory.id,
        name: "CI Load Product",
        price: 3.25,
      },
    });
    const loadContext = await browser.newContext();
    const loadPage = await loadContext.newPage();
    let captured = null;
    try {
      // Observe the exact React/Next.js Server Action wire format generated
      // by this actual production build, instead of guessing private headers.
      await loadPage.route(BASE + "/" + loadRestaurant.slug, async (route) => {
        const request = route.request();
        if (request.method() === "POST" && !captured) {
          const headers = await request.allHeaders();
          if (headers["next-action"]) {
            captured = { headers, body: request.postData() };
          }
        }
        await route.continue();
      });
      await loadPage.goto(BASE + "/" + loadRestaurant.slug);
      await loadPage.getByRole("button", {
        name: "CI Load Product — səbətə əlavə et",
      }).click();
      await loadPage.getByRole("button", { name: "Sifariş ver →", exact: true }).click();
      await loadPage.locator('input[name="customerName"]').fill("CI HTTP Load Customer");
      await loadPage.locator('input[name="customerPhone"]').fill("+994501234567");
      await loadPage.locator('textarea[name="addressText"]').fill("CI HTTP Load Test Street");
      await loadPage.getByRole("button", { name: /Nağd sifarişi göndər/ }).click();
      await loadPage.waitForURL(/\/order\/track\/[^/]+\?t=[a-f0-9]{64}/, {
        timeout: 30_000,
      });
      const seedId = decodeURIComponent(
        loadPage.url().match(/\/order\/track\/([^?]+)/)?.[1] ?? ""
      );
      assert.ok(captured?.body && captured.headers["next-action"],
        "Must capture a genuine Next.js Server Action request");
      assert.ok(captured.body.includes(seedId),
        "The original request must contain the client's UUID attempt ID");
      assert.equal(await db.order.count({
        where: { restaurantId: loadRestaurant.id },
      }), 1);

      const requestHeaders = {};
      for (const key of [
        "next-action", "next-router-state-tree", "next-url",
        "content-type", "accept", "rsc",
      ]) {
        if (captured.headers[key]) requestHeaders[key] = captured.headers[key];
      }
      requestHeaders.origin = BASE;

      const total = 300;
      const concurrent = 10;
      const ids = Array.from({ length: total }, () => randomUUID());
      assert.equal(new Set(ids).size, total);
      const times = [];
      const failures = [];
      let cursor = 0;
      const start = performance.now();
      await Promise.all(Array.from({ length: concurrent }, async () => {
        for (;;) {
          const index = cursor++;
          if (index >= total) return;
          const body = captured.body.split(seedId).join(ids[index]);
          const begun = performance.now();
          try {
            const response = await fetch(BASE + "/" + loadRestaurant.slug, {
              method: "POST",
              headers: requestHeaders,
              body,
              signal: AbortSignal.timeout(30_000),
            });
            await response.text();
            times.push(performance.now() - begun);
            if (!response.ok) failures.push("index=" + index + " HTTP " + response.status);
          } catch (error) {
            failures.push("index=" + index + " " + String(error).slice(0, 80));
          }
        }
      }));
      const elapsed = performance.now() - start;
      assert.deepEqual(failures, [], "HTTP Server Actions must all respond successfully");

      // HTTP 200 alone does not prove that a React Server Action succeeded.
      // Verify all 300 unique primary keys AND their nested order items.
      const inserted = await db.order.findMany({
        where: { restaurantId: loadRestaurant.id, id: { in: ids } },
        select: {
          id: true, status: true, total: true, paymentMethod: true,
          paymentStatus: true, items: { select: { quantity: true, lineTotal: true } },
        },
      });
      assert.equal(inserted.length, total,
        "Exactly 300 unique HTTP checkout requests must persist");
      for (const order of inserted) {
        assert.equal(order.status, "NEW");
        assert.equal(order.paymentMethod, "CASH");
        assert.equal(order.paymentStatus, "PENDING");
        assert.equal(order.total.toString(), "3.25");
        assert.equal(order.items.length, 1);
        assert.equal(order.items[0].quantity, 1);
        assert.equal(order.items[0].lineTotal.toString(), "3.25");
      }
      assert.equal(await db.order.count({
        where: { restaurantId: loadRestaurant.id },
      }), total + 1);
      assert.equal(await db.order.count({
        where: { restaurantId: restaurantB.id },
      }), 0);
      assert.equal(times.length, total);
      times.sort((a, b) => a - b);
      const percentile = (p) => Math.round(times[Math.ceil(total * p) - 1]);
      t.diagnostic("LOAD_RESULT HTTP createCashOrder: 300 requests, 10 concurrent, 0 errors, " +
        "elapsed_ms=" + Math.round(elapsed) +
        ", p50_ms=" + percentile(0.50) +
        ", p95_ms=" + percentile(0.95) +
        ", p99_ms=" + percentile(0.99) +
        ", max_ms=" + Math.round(times[times.length - 1]));
    } finally {
      await loadContext.close();
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

  await t.test("One QR: owner enables table and pickup, customers order, kitchen sees correct destination", async () => {
    await admin.goto(BASE + "/admin/order-settings");
    await admin.getByRole("heading", { name: "Masa və sifariş xidmətləri" }).waitFor();
    await admin.locator('input[name="tableCount"]').fill("12");
    await admin.locator('input[name="dineInEnabled"]').check();
    await admin.locator('input[name="pickupEnabled"]').check();
    await admin.getByRole("button", { name: /Yadda saxla/ }).click();
    await admin.getByRole("status").filter({ hasText: "Parametrlər yadda saxlanıldı." })
      .waitFor({ timeout: 25_000 });

    const orderByMode = async (type, tableNumber, label) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + "/" + restaurantA.slug);
        await page.getByRole("button", {
          name: "CI Browser Test Dish — səbətə əlavə et",
        }).click();
        await page.getByRole("button", { name: "Sifariş ver →", exact: true }).click();
        await page.locator('select[name="fulfillmentType"]').selectOption(type);
        if (type === "DINE_IN") {
          assert.equal(await page.locator('textarea[name="addressText"]').count(), 0);
          await page.locator('select[name="tableNumber"]').selectOption(String(tableNumber));
        }
        if (type === "PICKUP") {
          assert.equal(await page.locator('textarea[name="addressText"]').count(), 0);
          assert.equal(await page.locator('select[name="tableNumber"]').count(), 0);
        }
        await page.locator('input[name="customerName"]').fill(label);
        const phoneInput = page.locator('input[name="customerPhone"]');
        if (type === "DINE_IN") {
          assert.equal(await phoneInput.getAttribute("required"), null);
          assert.equal(await phoneInput.inputValue(), "");
          // Real no-phone submission: restaurant should identify this by table number.
        } else {
          assert.notEqual(await phoneInput.getAttribute("required"), null);
          await phoneInput.fill("+994501234567");
        }
        await page.getByRole("button", { name: /Nağd sifarişi göndər/ }).click();
        await page.waitForURL(/\/order\/track\/[^/]+\?t=[a-f0-9]{64}/, { timeout: 30_000 });
        const id = decodeURIComponent(page.url().match(/\/order\/track\/([^?]+)/)[1]);
        const order = await db.order.findUniqueOrThrow({ where: { id } });
        assert.equal(order.restaurantId, restaurantA.id);
        assert.equal(order.fulfillmentType, type);
        assert.equal(order.tableNumber, tableNumber);
        assert.equal(order.customerPhone, type === "DINE_IN" ? null : "+994501234567");
        assert.equal(order.addressText, null);
        await page.getByRole("heading", { name: "Sifarişimi izlə" }).waitFor();
        assert.match(await page.locator("main").last().innerText(), new RegExp(type === "DINE_IN" ? "Masa " + tableNumber : "Al-apar"));
        return id;
      } finally {
        await ctx.close();
      }
    };
    const tableId = await orderByMode("DINE_IN", 7, "CI Table Seven");
    const pickupId = await orderByMode("PICKUP", null, "CI Pickup Guest");

    await admin.goto(BASE + "/admin/orders?type=DINE_IN");
    await admin.getByRole("heading", { name: "Sifariş #" + tableId.slice(-8) }).waitFor();
    await admin.getByText("Masa 7", { exact: true }).waitFor();
    assert.equal(await admin.getByRole("button", { name: "Kuryerlə WhatsApp-da paylaş" }).count(), 0);
    assert.equal(await admin.getByRole("heading", { name: "Sifariş #" + pickupId.slice(-8) }).count(), 0);

    await admin.goto(BASE + "/admin/orders?type=PICKUP");
    await admin.getByRole("heading", { name: "Sifariş #" + pickupId.slice(-8) }).waitFor();
    await admin.getByText("Al-apar", { exact: true }).last().waitFor();
    assert.equal(await admin.getByRole("button", { name: "Kuryerlə WhatsApp-da paylaş" }).count(), 0);

    const activeCount = await db.order.count({
      where: { restaurantId: restaurantA.id, status: { in: ["NEW", "CONFIRMED", "PREPARING"] } },
    });
    const lastKitchenPage = Math.ceil(activeCount / 30);
    await admin.goto(BASE + "/admin/orders/kitchen?page=" + lastKitchenPage);
    await admin.getByText("Masa 7", { exact: true }).waitFor();
  });

  await t.test("Delivery map pin is chosen by tap/GPS, stored once and only visible to restaurant", async () => {
    const ctx = await browser.newContext({
      permissions: ["geolocation"],
      geolocation: { latitude: 40.402518, longitude: 49.901238 },
    });
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + "/" + restaurantA.slug);
      await page.getByRole("button", { name: "CI Browser Test Dish — səbətə əlavə et" }).click();
      await page.getByRole("button", { name: "Sifariş ver →", exact: true }).click();
      assert.equal(await page.getByTestId("delivery-map").count(), 0);
      await page.getByRole("button", { name: /Xəritədən çatdırılma yeri seç/ }).click();
      const map = page.getByTestId("delivery-map");
      await map.waitFor();
      await page.getByRole("button", { name: "Cari yerimi seç" }).click();
      await page.getByRole("status").filter({ hasText: "40.402518, 49.901238" })
        .waitFor({ timeout: 15_000 });

      // Map click should override GPS; a point on the actual interactive map is selected.
      const bounds = await map.boundingBox();
      assert.ok(bounds?.width > 100 && bounds.height > 100);
      await page.mouse.click(bounds.x + bounds.width / 2 + 25, bounds.y + bounds.height / 2 + 15);
      await page.getByTestId("delivery-pin").waitFor();
      await page.locator('input[name="customerName"]').fill("CI Map Delivery Customer");
      await page.locator('input[name="customerPhone"]').fill("+994501234567");
      await page.locator('textarea[name="addressText"]').fill("Baku CI Map Building 5, entrance 2");
      await page.getByRole("button", { name: /Nağd sifarişi göndər/ }).click();
      await page.waitForURL(/\/order\/track\/[^/]+\?t=[a-f0-9]{64}/, { timeout: 30_000 });
      const id = decodeURIComponent(page.url().match(/\/order\/track\/([^?]+)/)[1]);
      const order = await db.order.findUniqueOrThrow({ where: { id } });
      assert.equal(order.fulfillmentType, "DELIVERY");
      assert.equal(order.tableNumber, null);
      assert.ok(Math.abs(order.latitude - 40.402518) < 0.02);
      assert.ok(Math.abs(order.longitude - 49.901238) < 0.02);
      assert.equal(order.addressText, "Baku CI Map Building 5, entrance 2");

      // Customer tracking intentionally never leaks GPS, phone or address.
      const status = await page.request.get(BASE + "/order/track/" + id + "/status?t=" + new URL(page.url()).searchParams.get("t"));
      assert.equal(status.status(), 200);
      const statusData = await status.text();
      assert.doesNotMatch(statusData, /latitude|longitude|49\.901238|customerPhone|addressText/);

      await admin.goto(BASE + "/admin/orders?type=DELIVERY&q=" + id.slice(-8));
      await admin.getByRole("heading", { name: "Sifariş #" + id.slice(-8) }).waitFor();
      const link = admin.getByRole("link", { name: /Müştərinin göndərdiyi məkanı xəritədə aç/ });
      await link.waitFor();
      const url = new URL(await link.getAttribute("href"));
      assert.equal(url.hostname, "www.google.com");
      const [lat, lon] = url.searchParams.get("query").split(",").map(Number);
      assert.equal(lat, order.latitude);
      assert.equal(lon, order.longitude);

      // The courier gets exactly the saved delivery location and customer details.
      await admin.evaluate(() => {
        window.__courierShareLinks = [];
        window.open = (href, target) => {
          window.__courierShareLinks.push({ url: href, target });
          return null;
        };
      });
      await admin.getByRole("button", { name: "Kuryerlə WhatsApp-da paylaş" }).click();
      const shared = await admin.evaluate(() => window.__courierShareLinks.at(-1));
      assert.equal(shared.target, "_blank");
      const whatsapp = new URL(shared.url);
      assert.equal(whatsapp.hostname, "wa.me");
      const text = whatsapp.searchParams.get("text");
      assert.ok(text.includes("CI Map Delivery Customer"));
      assert.ok(text.includes("+994501234567"));
      assert.ok(text.includes("Baku CI Map Building 5, entrance 2"));
      assert.ok(text.includes("CI Browser Test Dish"));
      assert.ok(text.includes("7.45 ₼"));
      assert.ok(text.includes("https://www.google.com/maps/search/?api=1&query="));
      assert.ok(text.includes(order.latitude.toFixed(6)));
      assert.ok(text.includes(order.longitude.toFixed(6)));
      assert.doesNotMatch(text, /\/order\/track\/|\?t=[a-f0-9]{64}/);
    } finally {
      await ctx.close();
    }
  });
  await t.test("Admin uploads, replaces and removes a short video; customer can open it without autoplaying the whole menu", async () => {
    const mp4 = Buffer.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0, 0, 0, 0, 0]);
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01]);
    await admin.goto(BASE + "/admin?slug=" + restaurantA.slug);
    const newForm = admin.locator("form").filter({
      has: admin.getByRole("heading", { name: "🍔 Yeni məhsul" }),
    });
    await newForm.locator('select[name="categoryId"]').selectOption(category.id);
    await newForm.locator('input[name="name"]').fill("CI Video Menu Product");
    await newForm.locator('input[name="price"]').fill("8.50");
    await newForm.locator('input[name="description"]').fill("CI short food animation");
    await newForm.locator('input[name="videoFile"]').setInputFiles({
      name: "demo.mp4", mimeType: "video/mp4", buffer: mp4,
    });
    await newForm.getByRole("button", { name: /Məhsulu menyuya əlavə et/ }).click();
    await admin.getByText("CI Video Menu Product", { exact: true })
      .waitFor({ timeout: 30_000 });

    const product = await db.menuItem.findFirstOrThrow({
      where: { restaurantId: restaurantA.id, name: "CI Video Menu Product" },
      include: { video: true },
    });
    assert.equal(product.video?.mimeType, "video/mp4");
    assert.equal(product.video?.sizeBytes, mp4.length);
    assert.deepEqual(Buffer.from(product.video.payload), mp4);
    assert.equal(await db.menuItemVideo.count({ where: { menuItemId: product.id } }), 1);

    const ctx = await browser.newContext();
    const customerPage = await ctx.newPage();
    try {
      await customerPage.goto(BASE + "/" + restaurantA.slug);
      assert.equal(await customerPage.locator("video").count(), 0);
      await customerPage.getByRole("button", { name: "CI Video Menu Product — videoya bax" }).click();
      const dialog = customerPage.getByRole("dialog", { name: "CI Video Menu Product videosu" });
      await dialog.waitFor();
      assert.match(await dialog.locator("video").getAttribute("src"), new RegExp("/api/menu-video/" + product.id));
      assert.equal(await dialog.locator("video").evaluate((element) => element.muted), true);
      await dialog.getByRole("button", { name: "Videonu bağla" }).click();
      assert.equal(await customerPage.getByRole("dialog").count(), 0);
    } finally {
      await ctx.close();
    }

    // Replace by editing only this restaurant's menu item.
    const rowFor = () => admin.locator("div.border-b.py-3").filter({ hasText: "CI Video Menu Product" });
    await rowFor().locator('label[for="edit_' + product.id + '"]').click();
    let edit = rowFor().locator("form").last();
    await edit.locator('input[name="videoFile"]').setInputFiles({
      name: "demo.webm", mimeType: "video/webm", buffer: webm,
    });
    await edit.getByRole("button", { name: /Yadda saxla/ }).click();
    await admin.getByText("CI Video Menu Product", { exact: true }).waitFor();
    // Server Actions finish asynchronously. Poll the database rather than an old,
    // already-visible product name (which never proved the edit was persisted).
    let replaced = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      replaced = await db.menuItemVideo.findUnique({ where: { menuItemId: product.id } });
      if (replaced?.mimeType === "video/webm") break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.equal(replaced?.mimeType, "video/webm");
    assert.deepEqual(Buffer.from(replaced.payload), webm);

    // Remove the video but preserve the menu product and its photo field.
    await admin.goto(BASE + "/admin?slug=" + restaurantA.slug);
    await rowFor().locator('label[for="edit_' + product.id + '"]').click();
    edit = rowFor().locator("form").last();
    await edit.getByRole("button", { name: "Videonu sil" }).click();
    await edit.getByRole("button", { name: /Yadda saxla/ }).click();
    await admin.getByText("CI Video Menu Product", { exact: true }).waitFor();
    let remaining = -1;
    for (let attempt = 0; attempt < 60; attempt++) {
      remaining = await db.menuItemVideo.count({ where: { menuItemId: product.id } });
      if (remaining === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.equal(remaining, 0);
    assert.equal(await db.menuItem.count({ where: { id: product.id, restaurantId: restaurantA.id } }), 1);
  });

});
