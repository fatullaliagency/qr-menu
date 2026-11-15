import test from "node:test";
import assert from "node:assert/strict";
import { validateHotelTestDatabaseConfig } from "../app/lib/hotel-test-db-preflight.ts";
const approval="INITIALIZE_ISOLATED_HOTEL_TEST";
const hotel="postgresql://x:password@db.example.org:5432/qr_menu_hotel_staging?schema=public";
test("isolated hotel initializer rejects absent approval or invalid database names",()=>{
 assert.equal(validateHotelTestDatabaseConfig({databaseUrl:hotel}).ok,false);
 assert.equal(validateHotelTestDatabaseConfig({databaseUrl:"postgresql://x:pw@db.example.org/qr_menu_orders_test",approval}).ok,false);
 assert.equal(validateHotelTestDatabaseConfig({databaseUrl:"postgresql://x:pw@db.example.org/postgres",approval}).ok,false);
 assert.equal(validateHotelTestDatabaseConfig({databaseUrl:"file:/tmp/foo",approval}).ok,false);
});
test("same database is denied even with different credentials",()=>{
 assert.equal(validateHotelTestDatabaseConfig({
  databaseUrl:hotel,restaurantStagingUrl:"postgresql://someone:else@db.example.org/qr_menu_hotel_staging",approval
 }).ok,false);
 assert.equal(validateHotelTestDatabaseConfig({
  databaseUrl:hotel,productionUrl:"postgres://other:other@db.example.org/qr_menu_hotel_staging",approval
 }).ok,false);
});
test("new named hotel test database may pass only preliminary checks",()=>{
 const r=validateHotelTestDatabaseConfig({databaseUrl:hotel,restaurantStagingUrl:"postgresql://x:pw@db.example.org/restaurants",approval});
 assert.equal(r.ok,true);
 assert.match(r.reason,/inspect database emptiness/i);
});
