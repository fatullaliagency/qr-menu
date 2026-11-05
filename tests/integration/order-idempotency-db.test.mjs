import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { isMatchingCashOrder } from "../../app/lib/order-idempotency.ts";

// An exact, disposable CI database guard: this test MUST NOT run on any
// connected staging/production database, even with a misconfigured flag.
const EXPECTED_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/qr_menu_ci";
if (
  process.env.QR_MENU_EPHEMERAL_DB_TEST !== "true" ||
  process.env.DATABASE_URL !== EXPECTED_DATABASE_URL
) {
  throw new Error("Refusing PostgreSQL integration test outside disposable CI database.");
}

test("Real PostgreSQL enforces one order per retry ID across concurrent requests", async (t) => {
  const db = new PrismaClient();
  t.after(async () => { await db.$disconnect(); });

  const restaurantA = await db.restaurant.create({
    data: {
      name: "Disposable CI Restaurant A",
      slug: "ci-a-" + randomUUID(),
      phone: "0000000000",
    },
  });
  const restaurantB = await db.restaurant.create({
    data: {
      name: "Disposable CI Restaurant B",
      slug: "ci-b-" + randomUUID(),
      phone: "0000000000",
    },
  });
  const category = await db.category.create({
    data: { restaurantId: restaurantA.id, name: "CI dishes" },
  });
  const product = await db.menuItem.create({
    data: {
      restaurantId: restaurantA.id,
      categoryId: category.id,
      name: "CI test dish",
      price: 5.75,
    },
  });

  const requestId = randomUUID();
  const orderInput = {
    id: requestId,
    restaurantId: restaurantA.id,
    customerName: "CI Customer",
    customerPhone: "+994501234567",
    addressText: "CI Test Street 5",
    customerNote: null,
    subtotal: new Prisma.Decimal("11.50"),
    deliveryFee: new Prisma.Decimal("0"),
    total: new Prisma.Decimal("11.50"),
    status: "NEW",
    paymentMethod: "CASH",
    paymentStatus: "PENDING",
    items: {
      create: [{
        menuItemId: product.id,
        name: product.name,
        quantity: 2,
        unitPrice: new Prisma.Decimal("5.75"),
        lineTotal: new Prisma.Decimal("11.50"),
      }],
    },
  };

  await t.test("16 concurrent inserts with one request ID yield exactly one order", async () => {
    const outcomes = await Promise.allSettled(
      Array.from({ length: 16 }, () => db.order.create({ data: orderInput }))
    );
    const succeeded = outcomes.filter((r) => r.status === "fulfilled");
    const rejected = outcomes.filter((r) => r.status === "rejected");
    assert.equal(succeeded.length, 1);
    assert.equal(rejected.length, 15);
    for (const result of rejected) {
      assert.equal(result.reason?.code, "P2002");
    }
    assert.equal(await db.order.count({ where: { id: requestId } }), 1);
    assert.equal(await db.orderItem.count({ where: { orderId: requestId } }), 1);
  });

  const draft = {
    slug: restaurantA.slug,
    customerName: "CI Customer",
    customerPhone: "+994501234567",
    addressText: "CI Test Street 5",
    customerNote: "",
    items: [{ itemId: product.id, quantity: 2 }],
  };
  const loadReplay = async () => db.order.findUniqueOrThrow({
    where: { id: requestId },
    select: {
      restaurantId: true,
      customerName: true,
      customerPhone: true,
      addressText: true,
      customerNote: true,
      items: { select: { menuItemId: true, quantity: true } },
    },
  });

  await t.test("A retry still matches after restaurant confirms the order", async () => {
    await db.order.update({
      where: { id: requestId },
      data: { status: "CONFIRMED" },
    });
    assert.equal(isMatchingCashOrder(await loadReplay(), restaurantA.id, draft), true);
  });

  await t.test("Same request ID never grants another restaurant's order access", async () => {
    const stored = await loadReplay();
    assert.equal(isMatchingCashOrder(stored, restaurantB.id, draft), false);
    assert.equal(await db.order.count({ where: { restaurantId: restaurantB.id } }), 0);
    await assert.rejects(
      db.order.create({ data: { ...orderInput, restaurantId: restaurantB.id } }),
      (error) => error?.code === "P2002"
    );
    assert.equal(await db.order.count({ where: { restaurantId: restaurantB.id } }), 0);
  });

  await t.test("A changed phone, address or cart cannot replay an existing order", async () => {
    const stored = await loadReplay();
    for (const changed of [
      { ...draft, customerPhone: "+994551234567" },
      { ...draft, addressText: "Different street" },
      { ...draft, items: [{ itemId: product.id, quantity: 3 }] },
    ]) {
      assert.equal(isMatchingCashOrder(stored, restaurantA.id, changed), false);
    }
  });
});
