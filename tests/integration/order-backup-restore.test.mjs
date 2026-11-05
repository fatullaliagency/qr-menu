import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const SOURCE = "postgresql://postgres:postgres@127.0.0.1:5432/qr_menu_ci";
const RESTORE = "postgresql://postgres:postgres@127.0.0.1:5432/qr_menu_restore_ci";
if (
  process.env.QR_MENU_EPHEMERAL_DB_TEST !== "true" ||
  process.env.DATABASE_URL !== SOURCE ||
  SOURCE === RESTORE
) {
  throw new Error("Backup verification is restricted to disposable GitHub CI databases.");
}

const source = new PrismaClient();
const restored = new PrismaClient({ datasources: { db: { url: RESTORE } } });

test("A full pg_dump/pg_restore preserves every row and is isolated from its source", async (t) => {
  t.after(async () => {
    await Promise.all([source.$disconnect(), restored.$disconnect()]);
  });

  // Fixed allowlist prevents identifiers sourced from user input being
  // interpolated into SQL. Compare actual data, not only counts.
  const tables = [
    ["Restaurant", "id"],
    ["Category", "id"],
    ["MenuItem", "id"],
    ["AdminLoginAttempt", "key"],
    ["Order", "id"],
    ["OrderItem", "id"],
    ["RestaurantPaymentSettings", "restaurantId"],
    ["OrderStatusEvent", "id"],
  ];
  const digestTable = async (client, table, primaryKey) => {
    const rows = await client.$queryRawUnsafe(
      'SELECT * FROM public."' + table + '" ORDER BY "' + primaryKey + '"'
    );
    return {
      count: rows.length,
      sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
    };
  };
  const original = {};
  const duplicate = {};

  for (const [table, primaryKey] of tables) {
    const left = await digestTable(source, table, primaryKey);
    const right = await digestTable(restored, table, primaryKey);
    original[table] = left;
    duplicate[table] = right;
    assert.deepEqual(right, left,
      table + " row count/content differs after the full PostgreSQL restore");
  }

  assert.ok(original.Order.count >= 300,
    "The dump must include the 300 HTTP checkouts, not only an empty database");
  assert.ok(original.OrderItem.count >= 300,
    "The dump must preserve nested items from 300 HTTP checkouts");

  // Prove we restored into a truly independent database: changing a fixture
  // in the restored copy must not write anything back into the source.
  const slug = "ci-restore-only-" + randomUUID();
  await restored.restaurant.create({
    data: { name: "CI restore isolation probe", slug, phone: "0000000000" },
  });
  assert.equal(await source.restaurant.count({ where: { slug } }), 0);
  assert.equal(await restored.restaurant.count({ where: { slug } }), 1);

  t.diagnostic("RESTORE_RESULT full PostgreSQL custom dump: " +
    tables.length + " tables verified byte-equivalently at JSON row level; " +
    original.Order.count + " orders and " +
    original.OrderItem.count + " items; isolated restore verified");
});
