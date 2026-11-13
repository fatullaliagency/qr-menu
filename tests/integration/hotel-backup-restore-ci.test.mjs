import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
const SOURCE="postgresql://postgres:postgres@127.0.0.1:5432/qr_hotel_ci";
const TARGET="postgresql://postgres:postgres@127.0.0.1:5432/qr_hotel_restore_ci";
if(process.env.QR_MENU_EPHEMERAL_DB_TEST!=="true"||
   process.env.DATABASE_URL!==SOURCE||SOURCE===TARGET)
 throw new Error("Restore verification permitted only against disposable CI PostgreSQL databases.");
const source=new PrismaClient();
const restored=new PrismaClient({datasources:{db:{url:TARGET}}});
test("hotel folio, staff, QR, audit trail survive a full, independent PG restore",async t=>{
 t.after(async()=>{await Promise.all([source.$disconnect(),restored.$disconnect()]);});
 const tables=[
  ["Hotel","id"],["HotelRoom","id"],["HotelService","id"],
  ["HotelStaff","id"],["HotelGuestRequest","id"],["HotelOrder","id"],
  ["HotelOrderItem","id"],["HotelOrderEvent","id"],
  ["HotelRoomCharge","id"],["HotelRoomChargeEvent","id"],
 ];
 const snapshot=async(db,name,primary)=>{
  // Static code-only whitelist above prevents arbitrary SQL identifier injection.
  const rows=await db.$queryRawUnsafe('SELECT * FROM public."'+name+'" ORDER BY "'+primary+'"');
  return {count:rows.length,hash:createHash("sha256").update(JSON.stringify(rows)).digest("hex")};
 };
 for(const [table,key] of tables){
  const original=await snapshot(source,table,key);
  const copy=await snapshot(restored,table,key);
  assert.ok(original.count>=1,table+" must contain a nonempty test fixture");
  assert.deepEqual(copy,original,table+" contents differ after pg_restore");
 }
 const room=await restored.hotelRoom.findFirstOrThrow({include:{
  hotel:{select:{name:true}},
  charges:{include:{order:{include:{items:true,events:true}},events:true}},
 }});
 assert.equal(room.hotel.name,"CI hotel backup specimen");
 assert.equal(room.charges.length,1);
 assert.equal(room.charges[0].status,"APPROVED");
 assert.equal(room.charges[0].order.items[0].quantity,1);
 assert.equal(room.charges[0].events.length,2);
 const slug="ci-restored-only-"+randomUUID();
 await restored.hotel.create({data:{
  name:"CI independent restore probe",slug,phone:"+994501234567",pinCode:"not-used",
 }});
 assert.equal(await source.hotel.count({where:{slug}}),0);
 assert.equal(await restored.hotel.count({where:{slug}}),1);
 t.diagnostic("HOTEL RESTORE PASS: "+tables.length+" nonempty hotel tables verified; restore is independent of source.");
});
