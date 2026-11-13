import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { hotelRoomToken } from "../../app/lib/hotel-security.ts";

const EXPECTED="postgresql://postgres:postgres@127.0.0.1:5432/qr_hotel_ci";
if(process.env.QR_MENU_EPHEMERAL_DB_TEST!=="true" ||
   process.env.DATABASE_URL!==EXPECTED ||
   process.env.ENABLE_HOTEL_MODULE!=="true" ||
   (process.env.ADMIN_SESSION_SECRET?.length??0)<32)
  throw new Error("Hotel browser test is allowed only against disposable local CI database.");
const BASE="http://127.0.0.1:3199";
const scrypt=promisify(scryptCallback);
async function hash(pin){
 const salt=randomBytes(16),derived=await scrypt(pin,salt,64);
 return "scrypt$v1$"+salt.toString("hex")+"$"+derived.toString("hex");
}
async function ready(proc,getLogs){
 for(let i=0;i<160;i++){
  if(proc.exitCode!==null)throw new Error("Next server stopped: "+getLogs());
  try{
   const r=await fetch(BASE+"/hotel-admin",{signal:AbortSignal.timeout(1200)});
   if(r.status===200)return;
  }catch{}
  await new Promise(ok=>setTimeout(ok,250));
 }
 throw new Error("Hotel Next start timeout: "+getLogs());
}
test("Chromium: hotel room QR, guest cart, department status and hotel isolation",{
 timeout:300000,
},async t=>{
 const db=new PrismaClient();
 const hotelIds=[];
 let server,browser,logs="";
 t.after(async()=>{
  if(browser)await browser.close();
  if(server?.exitCode===null)server.kill("SIGTERM");
  try{if(hotelIds.length)await db.hotel.deleteMany({where:{id:{in:hotelIds}}});}
  finally{await db.$disconnect();}
 });
 const suffix=randomUUID(),pinA="629183",pinB="749286";
 const [a,b]=await Promise.all([
  db.hotel.create({data:{name:"CI Hotel Alpha",slug:"ci-hotel-alpha-"+suffix,
   phone:"+994501234567",pinCode:await hash(pinA),roomCount:1,
   rooms:{create:{number:"101",status:"OCCUPIED"}}}}),
  db.hotel.create({data:{name:"CI Hotel Beta",slug:"ci-hotel-beta-"+suffix,
   phone:"+994501234568",pinCode:await hash(pinB),roomCount:1,
   rooms:{create:{number:"101",status:"OCCUPIED"}}}}),
 ]);
 hotelIds.push(a.id,b.id);
 const room=await db.hotelRoom.findFirstOrThrow({where:{hotelId:a.id,number:"101"}});
 const [food,towel]=await Promise.all([
  db.hotelService.create({data:{hotelId:a.id,category:"FOOD",department:"KITCHEN",
   name:"CI Hotel Soup",price:"6.50"}}),
  db.hotelService.create({data:{hotelId:a.id,category:"ROOM_SERVICE",department:"HOUSEKEEPING",
   name:"CI Hotel Towel",price:"0.00"}}),
 ]);
 const token=hotelRoomToken(process.env.ADMIN_SESSION_SECRET,a.id,room.id,room.qrNonce);
 const guestUrl=BASE+"/hotel/"+a.slug+"/room/101?t="+token;
 server=spawn(process.execPath,[
  "node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p","3199",
 ],{env:process.env,stdio:["ignore","pipe","pipe"]});
 for(const stream of [server.stdout,server.stderr])
  stream.on("data",bytes=>{logs=(logs+bytes.toString()).slice(-6000)});
 await ready(server,()=>logs);
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const adminCtx=await browser.newContext({extraHTTPHeaders:{"x-vercel-forwarded-for":"127.0.0.1"}});
 const admin=await adminCtx.newPage();
 const guestCtx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const guest=await guestCtx.newPage();

 await t.test("Hotel manager PIN grants only own hotel dashboard",async()=>{
  await admin.goto(BASE+"/hotel-admin");
  await admin.locator('input[name="slug"]').fill(a.slug);
  await admin.locator('input[name="pin"]').fill(pinA);
  await admin.getByRole("button",{name:"Daxil ol"}).click();
  await admin.getByRole("heading",{name:a.name}).waitFor({timeout:20000});
  assert.equal((await admin.locator("body").innerText()).includes(b.name),false);
 });

 await t.test("Wrong and cross-hotel QR tokens cannot open the room",async()=>{
  // Next.js streams the 404 boundary and may retain HTTP 200 after suspense flush.
  // The security requirement is that the invalid QR never reveals any service data.
  for (const invalidUrl of [
    BASE+"/hotel/"+a.slug+"/room/101?t=wrong",
    BASE+"/hotel/"+b.slug+"/room/101?t="+token,
  ]) {
    const response=await fetch(invalidUrl);
    assert.ok(response.status===200||response.status===404);
    const html=await response.text();
    assert.doesNotMatch(html,/CI Hotel Soup|CI Hotel Towel/);
  }
  assert.equal((await fetch(guestUrl)).status,200);
 });

 let requestId="";
 await t.test("Guest adds food and towel in one cart and receives single tracking link",async()=>{
  await guest.goto(guestUrl,{waitUntil:"domcontentloaded"});
  await guest.getByRole("heading",{name:"CI Hotel Soup"}).waitFor({timeout:20000});
  await guest.getByRole("heading",{name:"CI Hotel Towel"}).waitFor({timeout:20000});
  const controls=guest.locator('input[type="number"]');
  assert.equal(await controls.count(),2);
  await controls.nth(0).fill("2");
  await controls.nth(1).fill("1");
  await guest.getByRole("button",{name:"Otaq hesabına sifariş göndər"}).click();
  await guest.waitForURL(/\/hotel\/[^/]+\/track\/[0-9a-f-]+\?t=[A-Za-z0-9_-]{43}/,{timeout:30000});
  requestId=decodeURIComponent(guest.url().match(/\/track\/([^?]+)/)?.[1]??"");
  assert.ok(requestId);
  const req=await db.hotelGuestRequest.findUnique({
   where:{clientRequestId:requestId},include:{orders:{include:{items:true}}},
  });
  assert.equal(req?.hotelId,a.id);
  assert.equal(req?.roomId,room.id);
  assert.equal(req?.orders.length,2);
  const byDept=new Map(req.orders.map(o=>[o.department,o]));
  assert.equal(byDept.get("KITCHEN")?.status,"NEW");
  assert.equal(byDept.get("KITCHEN")?.total.toString(),"13");
  assert.equal(byDept.get("HOUSEKEEPING")?.total.toString(),"0");
  assert.equal(byDept.get("KITCHEN")?.items[0]?.serviceId,food.id);
  assert.equal(byDept.get("HOUSEKEEPING")?.items[0]?.serviceId,towel.id);
  assert.equal(await db.hotelOrder.count({where:{hotelId:b.id}}),0);
  const charges=await db.hotelRoomCharge.findMany({where:{hotelId:a.id},
   include:{events:true,order:{select:{status:true}}}});
  assert.equal(charges.length,2);
  assert.equal(charges.filter(x=>x.status==="PENDING").length,2);
  assert.equal(charges.find(x=>x.orderId===byDept.get("KITCHEN")?.id)?.amount.toString(),"13");
  assert.equal(charges.filter(x=>x.events.length===1).length,2);
  assert.equal(charges[0].stayKey.length,20);
  assert.equal(charges[0].stayKey,charges[1].stayKey);
  assert.equal(await db.hotelRoomCharge.count({where:{hotelId:b.id}}),0);
 });

 await t.test("Guest tracking token protects order status from other hotels",async()=>{
  const good=new URL(guest.url());
  const valid=await fetch(BASE+good.pathname+"/status"+good.search);
  assert.equal(valid.status,200);
  assert.equal((await valid.json()).orders.length,2);
  assert.equal((await fetch(BASE+good.pathname+"/status")).status,404);
  assert.equal((await fetch(BASE+"/hotel/"+b.slug+"/track/"+requestId+"/status"+good.search)).status,404);
 });

 await t.test("Kitchen and housekeeping display their own tasks and record ordered statuses",async()=>{
  await admin.goto(BASE+"/hotel-admin/panel/kitchen");
  await admin.getByRole("heading",{name:"Otaq № 101"}).waitFor({timeout:20000});
  assert.match(await admin.locator("body").innerText(),/CI Hotel Soup/);
  assert.doesNotMatch(await admin.locator("body").innerText(),/CI Hotel Towel/);
  await admin.getByRole("button",{name:"Qəbul edildi et"}).click();
  // A React Server Action commits asynchronously after the click event.
  await admin.getByRole("button",{name:"Hazırlanır et"}).waitFor({timeout:20000});
  const kitchen=await db.hotelOrder.findFirstOrThrow({where:{hotelId:a.id,department:"KITCHEN"}});
  assert.equal(kitchen.status,"ACCEPTED");
  assert.equal(await db.hotelOrderEvent.count({where:{hotelId:a.id,orderId:kitchen.id}}),2);
  await admin.goto(BASE+"/hotel-admin/panel/housekeeping");
  await admin.getByText("CI Hotel Towel").waitFor({timeout:20000});
  assert.match(await admin.locator("body").innerText(),/CI Hotel Towel/);
  assert.doesNotMatch(await admin.locator("body").innerText(),/CI Hotel Soup/);
 });

 await t.test("Hotel B dashboard and notifications cannot view hotel A tasks",async()=>{
  const bCtx=await browser.newContext({extraHTTPHeaders:{"x-vercel-forwarded-for":"127.0.0.1"}});
  try{
   const panel=await bCtx.newPage();
   await panel.goto(BASE+"/hotel-admin");
   await panel.locator('input[name="slug"]').fill(b.slug);
   await panel.locator('input[name="pin"]').fill(pinB);
   await panel.getByRole("button",{name:"Daxil ol"}).click();
   await panel.getByRole("heading",{name:b.name}).waitFor({timeout:20000});
   await panel.goto(BASE+"/hotel-admin/panel/kitchen");
   await panel.getByText("Hələ müraciət yoxdur.").waitFor({timeout:20000});
   assert.doesNotMatch(await panel.locator("body").innerText(),/CI Hotel Soup/);
   const api=await panel.evaluate(async()=>{
    const r=await fetch("/hotel-admin/notifications?department=KITCHEN");
    return {status:r.status,body:await r.json()};
   });
   assert.equal(api.status,200);
   assert.equal(api.body.scope,b.id);
   assert.equal(api.body.newCount,0);
  }finally{await bCtx.close();}
 });



 await t.test("Manager may approve a completed internal charge, not pending service or bank payment",async()=>{
  const kitchenOrder=await db.hotelOrder.findFirstOrThrow({where:{hotelId:a.id,department:"KITCHEN"}});
  const foodCharge=await db.hotelRoomCharge.findUniqueOrThrow({where:{orderId:kitchenOrder.id}});
  await admin.goto(BASE+"/hotel-admin/billing");
  await admin.getByRole("heading",{name:/Otaq hesabları/}).waitFor({timeout:20000});
  assert.equal(await admin.locator('[data-charge-id="'+foodCharge.id+'"] button').filter({hasText:"Otaq hesabını təsdiqlə"}).count(),0);
  await admin.goto(BASE+"/hotel-admin/panel/kitchen");
  for(const [button,next] of [
    ["Hazırlanır et","Göndərildi et"],
    ["Göndərildi et","Tamamlandı et"],
    ["Tamamlandı et",null],
  ]){
    await admin.getByRole("button",{name:button}).click();
    if(next)await admin.getByRole("button",{name:next}).waitFor({timeout:20000});
    else await admin.getByText("Tamamlandı",{exact:true}).first().waitFor({timeout:20000});
  }
  assert.equal(await db.hotelOrderEvent.count({where:{hotelId:a.id,orderId:kitchenOrder.id}}),5);
  await admin.goto(BASE+"/hotel-admin/billing");
  const row=admin.locator('[data-charge-id="'+foodCharge.id+'"]');
  await row.getByRole("button",{name:"Otaq hesabını təsdiqlə"}).click();
  await row.getByText("Daxili təsdiq",{exact:true}).waitFor({timeout:20000});
  const approved=await db.hotelRoomCharge.findUniqueOrThrow({
   where:{id:foodCharge.id},include:{events:true}
  });
  assert.equal(approved.status,"APPROVED");
  assert.equal(approved.events.length,2);
  assert.equal(approved.amount.toString(),"13");
  assert.equal(approved.approvedBy,"HOTEL_MANAGER");
  assert.equal(await db.hotelRoomCharge.count({where:{hotelId:b.id}}),0);
  // Browser APIRequestContext may not carry the same HttpOnly session cookie;
  // validate the report from the authenticated in-page fetch instead.
  const report=await admin.evaluate(async()=>{
   const r=await fetch("/hotel-admin/billing/export",{credentials:"same-origin",cache:"no-store"});
   return {status:r.status,type:r.headers.get("content-type"),cache:r.headers.get("cache-control"),csv:await r.text()};
  });
  assert.equal(report.status,200);
  assert.match(report.type??"",/text\/csv/);
  assert.match(report.cache??"",/no-store/);
  assert.match(report.csv,/CI Hotel Alpha/);
  assert.match(report.csv,/APPROVED/);
  assert.match(report.csv,/13\.00/);
  assert.doesNotMatch(report.csv,/CI Hotel Beta/);
  const badRange=await admin.evaluate(async()=>{
   const r=await fetch("/hotel-admin/billing/export?from=2026-10-01&to=2026-11-13",{credentials:"same-origin"});
   return r.status;
  });
  assert.equal(badRange,400);
  const guestDenied=await guest.evaluate(async()=>{
   const r=await fetch("/hotel-admin/billing/export",{credentials:"same-origin"});
   return r.status;
  });
  assert.equal(guestDenied,401);
 });

 await t.test("Guest tracking updates after service completion",async()=>{
  await guest.getByText("Mətbəx / restoran: Tamamlandı",{exact:false}).waitFor({timeout:30000});
  assert.match(await guest.locator("body").innerText(),/Tamamlandı/);
 });

 await t.test("Individual kitchen staff has no access to housekeeping, manager settings or revoked session",async()=>{
  const staffUsername="chef-"+randomUUID().slice(0,6),staffPin="651298";
  const member=await db.hotelStaff.create({data:{
   hotelId:a.id,username:staffUsername,name:"CI Kitchen Staff",department:"KITCHEN",
   pinCode:await hash(staffPin),
  }});
  const context=await browser.newContext({extraHTTPHeaders:{"x-vercel-forwarded-for":"127.0.0.1"}});
  try {
   const page=await context.newPage();
   await page.goto(BASE+"/hotel-staff");
   await page.locator('input[name="slug"]').fill(a.slug);
   await page.locator('input[name="username"]').fill(staffUsername);
   await page.locator('input[name="pin"]').fill(staffPin);
   await page.getByRole("button",{name:"Daxil ol"}).click();
   await page.waitForURL(/\/hotel-admin\/panel\/kitchen/,{timeout:20000});
   await page.getByRole("heading",{name:"Otaq № 101"}).waitFor({timeout:20000});
   assert.match(await page.locator("body").innerText(),/CI Hotel Soup/);
   assert.doesNotMatch(await page.locator("body").innerText(),/CI Hotel Towel/);
   const status=await page.evaluate(async()=>{
    const okay=await fetch("/hotel-admin/notifications?department=KITCHEN");
    const forbidden=await fetch("/hotel-admin/notifications?department=HOUSEKEEPING");
    return [okay.status,forbidden.status];
   });
   assert.deepEqual(status,[200,403]);
   await page.goto(BASE+"/hotel-admin/panel/housekeeping");
   assert.doesNotMatch(await page.locator("body").innerText(),/CI Hotel Towel/);
   const deniedBilling=await page.evaluate(async()=>{
    const r=await fetch("/hotel-admin/billing/export",{credentials:"same-origin"});
    return r.status;
   });
   assert.equal(deniedBilling,401);
   await page.goto(BASE+"/hotel-admin/billing");
   await page.locator('input[name="pin"]').waitFor({timeout:20000});
   await page.goto(BASE+"/hotel-admin");
   await page.locator('input[name="pin"]').waitFor({timeout:20000});
   await db.hotelStaff.update({where:{id:member.id},data:{active:false,sessionVersion:randomUUID()}});
   await page.goto(BASE+"/hotel-admin/panel/kitchen");
   await page.waitForURL(/\/hotel-staff/,{timeout:20000});
   const revoked=await page.evaluate(async()=>{
    const r=await fetch("/hotel-admin/notifications?department=KITCHEN");
    return r.status;
   });
   assert.equal(revoked,401);
  }finally{await context.close();}
 });

 await t.test("Checkout blocks pending room folio, then invalidates previous QR",async()=>{
  const towelOrder=await db.hotelOrder.findFirstOrThrow({
   where:{hotelId:a.id,department:"HOUSEKEEPING"}
  });
  const towelCharge=await db.hotelRoomCharge.findUniqueOrThrow({
   where:{orderId:towelOrder.id}
  });
  await admin.goto(BASE+"/hotel-admin");
  await admin.getByRole("heading",{name:"Otaq № 101"}).waitFor({timeout:20000});
  const roomCard=admin.locator("article").filter({
   has:admin.getByRole("heading",{name:"Otaq № 101"})
  });
  const outstanding=await db.hotelRoomCharge.count({
   where:{hotelId:a.id,roomId:room.id,status:"PENDING"}
  });
  assert.equal(outstanding,1);
  // Native OPTION disabled="" is authoritative; Playwright isDisabled() can
  // report false for an option when the parent SELECT itself is enabled.
  assert.notEqual(await roomCard.locator('option[value="VACANT"]').getAttribute("disabled"),null);

  await admin.goto(BASE+"/hotel-admin/billing");
  const chargeCard=admin.locator('[data-charge-id="'+towelCharge.id+'"]');
  await chargeCard.getByRole("button",{name:"Gözləyən qeydi ləğv et"}).click();
  await chargeCard.getByText("Ləğv edildi",{exact:true}).waitFor({timeout:20000});
  await admin.goto(BASE+"/hotel-admin");
  const active=admin.locator("article").filter({has:admin.getByRole("heading",{name:"Otaq № 101"})});
  assert.equal(await active.locator('option[value="VACANT"]').getAttribute("disabled"),null);
  await active.locator('select[name="status"]').selectOption("VACANT");
  await active.getByRole("button",{name:"Yadda saxla"}).click();
  let latest;
  for(let i=0;i<50;i++){
   latest=await db.hotelRoom.findUniqueOrThrow({where:{id:room.id}});
   if(latest.status==="VACANT")break;
   await new Promise(done=>setTimeout(done,200));
  }
  assert.equal(latest?.status,"VACANT");
  assert.notEqual(latest.qrNonce,room.qrNonce);
  const response=await fetch(guestUrl);
  assert.ok(response.status===200||response.status===404);
  const html=await response.text();
  assert.doesNotMatch(html,/CI Hotel Soup|CI Hotel Towel/);
 });
});
