import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { chromium, webkit } from "playwright";
import { hotelRoomToken } from "../../app/lib/hotel-security.ts";

const EXPECTED="postgresql://postgres:postgres@127.0.0.1:5432/qr_hotel_ci";
if(process.env.QR_MENU_EPHEMERAL_DB_TEST!=="true" ||
   process.env.DATABASE_URL!==EXPECTED ||
   process.env.ENABLE_HOTEL_MODULE!=="true" ||
   (process.env.ADMIN_SESSION_SECRET?.length??0)<32)
  throw new Error("Hotel browser test is allowed only against disposable local CI database.");
const BASE="http://127.0.0.1:3199";
const BROWSER=process.env.HOTEL_E2E_BROWSER||"chromium";
if(!["chromium","webkit"].includes(BROWSER))throw new Error("Unknown hotel test browser.");
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
test(BROWSER+": hotel room QR, guest cart, department status and hotel isolation",{
 timeout:300000,
},async t=>{
 const db=new PrismaClient();
 const hotelIds=[];
 let server,browser,logs="";
 t.after(async()=>{
  if(browser)await browser.close();
  if(server?.exitCode===null){
   server.kill("SIGTERM");
   await Promise.race([
    new Promise(resolve=>server.once("exit",resolve)),
    new Promise(resolve=>setTimeout(resolve,2500)),
   ]);
  }
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
 const [food,towel,transfer,spa]=await Promise.all([
  db.hotelService.create({data:{hotelId:a.id,category:"FOOD",department:"KITCHEN",
   name:"CI Hotel Soup",price:"6.50"}}),
  db.hotelService.create({data:{hotelId:a.id,category:"ROOM_SERVICE",department:"HOUSEKEEPING",
   name:"CI Hotel Towel",price:"0.00"}}),
  db.hotelService.create({data:{hotelId:a.id,category:"TRANSFER",department:"TRANSFER",
   name:"CI Airport Pickup",price:"18.00"}}),
  db.hotelService.create({data:{hotelId:a.id,category:"SPA",department:"SPA",
   name:"CI Spa Massage",price:"40.00"}}),
 ]);
 const token=hotelRoomToken(process.env.ADMIN_SESSION_SECRET,a.id,room.id,room.qrNonce);
 const guestUrl=BASE+"/hotel/"+a.slug+"/room/101?t="+token;
 server=spawn(process.execPath,[
  "node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p","3199",
 ],{env:process.env,stdio:["ignore","pipe","pipe"]});
 for(const stream of [server.stdout,server.stderr])
  stream.on("data",bytes=>{logs=(logs+bytes.toString()).slice(-6000)});
 await ready(server,()=>logs);
 browser=await (BROWSER==="webkit"?webkit:chromium).launch(
  BROWSER==="chromium"?{headless:true,args:["--no-sandbox"]}:{headless:true}
 );
 const adminCtx=await browser.newContext({extraHTTPHeaders:{"x-vercel-forwarded-for":"127.0.0.1"}});
 const admin=await adminCtx.newPage();
 const guestCtx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const guest=await guestCtx.newPage();

 await t.test("No-database phone diagnostics are available on the dedicated test host",async()=>{
  const devicePage=await browser.newPage();
  try{
   const r=await devicePage.goto(BASE+"/hotel-device-check");
   assert.equal(r?.status(),200);
   await devicePage.getByRole("heading",{name:"Telefon və brauzer yoxlaması"}).waitFor({timeout:20000});
   await devicePage.getByRole("button",{name:"Kameranı yoxla"}).waitFor();
   await devicePage.getByRole("button",{name:"Test səsini çal"}).waitFor();
   await devicePage.getByRole("button",{name:"Bildirişi yoxla"}).waitFor();
   // No camera or notification permissions are requested without a user click.
  }finally{await devicePage.close();}
 });

 await t.test("Phone diagnostic interactions handle permission denial, offline status and clipboard",async()=>{
  // Emulated-browser checks only: these do not certify real hardware or audible sound.
  const deviceCtx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const devicePage=await deviceCtx.newPage();
  const unexpectedWrites=[];
  devicePage.on("request",req=>{
   if(req.method()!=="GET"&&new URL(req.url()).pathname.startsWith("/hotel-device-check"))
    unexpectedWrites.push(req.url());
  });
  try{
   const response=await devicePage.goto(BASE+"/hotel-device-check",{waitUntil:"domcontentloaded"});
   assert.equal(response?.status(),200);
   // React useEffect has run, so the diagnostic event handlers are hydrated.
   await devicePage.getByText("Brauzer onlayn görünür",{exact:true}).waitFor({timeout:20000});
   await devicePage.evaluate(()=>{
    if(navigator.mediaDevices){
     Object.defineProperty(navigator.mediaDevices,"getUserMedia",{
      configurable:true,value:async()=>{throw new DOMException("QA permission denial","NotAllowedError");},
     });
    }
    Object.defineProperty(navigator,"clipboard",{
     configurable:true,value:{writeText:async(value)=>{window.__hotelQaClipboard=value;}},
    });
   });
   await devicePage.getByRole("button",{name:"Kameranı yoxla"}).click();
   await devicePage.waitForFunction(()=>{
    const text=document.body.innerText;
    return text.includes("Kamera nəticəsi:")&&!text.includes("Kamera nəticəsi: yoxlanmayıb");
   },null,{timeout:10000});
   const cameraText=await devicePage.locator("section").first().innerText();
   assert.match(cameraText,/Kamera nəticəsi: (icazə verilmədi|dəstəklənmir)/);
   await deviceCtx.setOffline(true);
   await devicePage.evaluate(()=>window.dispatchEvent(new Event("offline")));
   await devicePage.getByText("Brauzer oflayn görünür",{exact:true}).waitFor({timeout:10000});
   await deviceCtx.setOffline(false);
   await devicePage.evaluate(()=>window.dispatchEvent(new Event("online")));
   await devicePage.getByText("Brauzer onlayn görünür",{exact:true}).waitFor({timeout:10000});
   // Verify UI triggers without claiming sound was actually heard or a push reached a device.
   await devicePage.getByRole("button",{name:"Test səsini çal"}).click();
   await devicePage.waitForFunction(()=>
    !document.body.innerText.includes("Səs əməliyyatı: yoxlanmayıb"),null,{timeout:10000});
   await devicePage.getByRole("button",{name:"Bildirişi yoxla"}).click();
   await devicePage.waitForFunction(()=>
    !document.body.innerText.includes("Bildiriş nəticəsi: yoxlanmayıb"),null,{timeout:10000});
   await devicePage.getByRole("button",{name:"Test nəticəsini kopyala"}).click();
   await devicePage.getByText("Nəticə cihazın mübadilə yaddaşına kopyalandı.").waitFor({timeout:10000});
   const copied=await devicePage.evaluate(()=>window.__hotelQaClipboard);
   assert.match(copied,/Kamera: (icazə verilmədi|dəstəklənmir)/);
   assert.match(copied,/Şəbəkə: Brauzer onlayn görünür/);
   assert.match(copied,/Səsi real eşitdim: Təsdiqlənməyib/);
   assert.equal(unexpectedWrites.length,0,"Phone diagnostics must not upload or create data");
  }finally{
   await deviceCtx.setOffline(false);
   await deviceCtx.close();
  }
 });

 await t.test("Superadmin creates hotel via protected UI and manager can access its own rooms",async()=>{
  // CI-only SUPERADMIN_ACCESS_KEY must not be a real Vercel secret.
  assert.equal(process.env.ENABLE_SUPERADMIN_PANEL,"true");
  assert.equal(process.env.SUPERADMIN_ACCESS_KEY?.startsWith("ci-only-test-superadmin"),true);
  const superCtx=await browser.newContext();
  const managerCtx=await browser.newContext({extraHTTPHeaders:{"x-vercel-forwarded-for":"127.0.0.1"}});
  try{
   const superPage=await superCtx.newPage();
   await superPage.goto(BASE+"/superadmin");
   await superPage.getByRole("heading",{name:"QR Menü — Super Admin"}).waitFor({timeout:20000});
   const protectedPage=await managerCtx.newPage();
   await protectedPage.goto(BASE+"/superadmin/hotels/new");
   await protectedPage.getByRole("heading",{name:"QR Menü — Super Admin"}).waitFor({timeout:20000});
   await superPage.locator('input[name="accessKey"]').fill(process.env.SUPERADMIN_ACCESS_KEY);
   await superPage.getByRole("button",{name:"Super Admin kimi daxil ol"}).click();
   await superPage.getByRole("link",{name:"+ Yeni müəssisə"}).waitFor({timeout:25000});
   await superPage.getByRole("link",{name:"+ Yeni müəssisə"}).click();
   await superPage.getByRole("heading",{name:"Yeni müəssisə yaradın"}).waitFor({timeout:20000});
   await superPage.getByRole("link",{name:"Otel əlavə et"}).click();
   await superPage.getByRole("heading",{name:"Yeni otel yarat"}).waitFor({timeout:20000});
   const hotelName="CI Super Hotel "+randomUUID().slice(0,8);
   const managerPin="845123";
   await superPage.locator('input[name="name"]').fill(hotelName);
   await superPage.locator('input[name="branchName"]').fill("CI Reception Branch");
   await superPage.locator('input[name="roomCount"]').fill("2");
   await superPage.locator('input[name="phone"]').fill("+994501112233");
   await superPage.locator('input[name="pin"]').fill(managerPin);
   await superPage.getByRole("button",{name:"Otel yarat"}).click();
   await superPage.waitForURL(/\/superadmin\/hotels\/new\?created=/,{timeout:30000});
   const createdSlug=new URL(superPage.url()).searchParams.get("created");
   assert.match(createdSlug??"",/^[a-z0-9-]{3,60}$/);
   const created=await db.hotel.findUniqueOrThrow({where:{slug:createdSlug},
    include:{rooms:true}});
   hotelIds.push(created.id);
   assert.equal(created.name,hotelName);
   assert.equal(created.roomCount,2);
   assert.deepEqual(created.rooms.map(r=>r.number).sort(),["1","2"]);
   assert.equal(created.spaEnabled,true);
   assert.equal(created.transferEnabled,true);
   assert.notEqual(created.id,a.id);
   assert.notEqual(created.id,b.id);

   const managerPage=await managerCtx.newPage();
   await managerPage.goto(BASE+"/hotel-admin");
   await managerPage.locator('input[name="slug"]').fill(created.slug);
   await managerPage.locator('input[name="pin"]').fill(managerPin);
   await managerPage.getByRole("button",{name:"Daxil ol"}).click();
   await managerPage.getByRole("heading",{name:hotelName}).waitFor({timeout:25000});
   const html=await managerPage.locator("body").innerText();
   assert.doesNotMatch(html,/CI Hotel Alpha|CI Hotel Beta/);
   await managerPage.getByRole("link",{name:"Otaq QR-lərini toplu çap et"}).click();
   await managerPage.getByRole("heading",{name:"Otaq QR kodlarını çap et"}).waitFor({timeout:20000});
   await managerPage.locator("[data-print-room]").first().waitFor({timeout:25000});
   assert.equal(await managerPage.locator("[data-print-room]").count(),2);
   assert.doesNotMatch(await managerPage.locator("body").innerText(),/CI Hotel Alpha|CI Hotel Beta/);

   await superPage.goto(BASE+"/superadmin");
   const crossSiteLogout=await superCtx.request.post(BASE+"/superadmin/logout",{
    headers:{"origin":"https://untrusted.example"},maxRedirects:0,
   });
   assert.equal(crossSiteLogout.status(),403);
   await superPage.reload();
   await superPage.getByRole("button",{name:"Çıxış"}).waitFor({timeout:20000});
   await superPage.getByRole("button",{name:"Çıxış"}).click();
   await superPage.getByRole("heading",{name:"QR Menü — Super Admin"}).waitFor({timeout:20000});
   // WebKit does not consistently expose navigation POST responses via page events.
   // Verify the HTTP redirect and cookie deletion separately, in the same context.
   const logoutResponse=await superCtx.request.post(BASE+"/superadmin/logout",{
    // APIRequestContext is not a browser navigation; supply browser fetch metadata.
    headers:{origin:BASE,"sec-fetch-site":"same-origin"},maxRedirects:0,
   });
   assert.equal(logoutResponse.status(),303,"Logout POST must issue a 303 See Other");
   assert.equal(logoutResponse.headers()["set-cookie"]?.includes("qr_superadmin_session="),true,
    "Logout must include session-cookie deletion response header");
   // A client-side optimistic transition is not sufficient: a fresh server
   // request must reject the old cookie after sign-out.
   await superPage.reload({waitUntil:"domcontentloaded"});
   await superPage.getByRole("heading",{name:"QR Menü — Super Admin"}).waitFor({timeout:20000});
   // The security invariant is server-side authorization, not the presence
   // or absence of a stale client cookie entry (which varies by browser engine).
   await superPage.goto(BASE+"/superadmin/hotels/new",{waitUntil:"domcontentloaded"});
   await superPage.waitForLoadState("networkidle");
   assert.equal(await superPage.locator('input[name="roomCount"]').count(),0,
    "Logged-out browser must not reach hotel creation form");
   assert.equal(await superPage.locator('input[name="pin"]').count(),0,
    "Logged-out browser must not reach hotel admin PIN creation form");
  }finally{
   await superCtx.close();
   await managerCtx.close();
  }
 });

 await t.test("Hotel manager PIN grants only own hotel dashboard",async()=>{
  await admin.goto(BASE+"/hotel-admin");
  await admin.locator('input[name="slug"]').fill(a.slug);
  await admin.locator('input[name="pin"]').fill(pinA);
  await admin.getByRole("button",{name:"Daxil ol"}).click();
  await admin.getByRole("heading",{name:a.name}).waitFor({timeout:20000});
  assert.equal((await admin.locator("body").innerText()).includes(b.name),false);
 });

 let alphaQrImage="";
 await t.test("Manager-only room QR print sheets are tenant-scoped and fully generated locally",async()=>{
  await admin.getByRole("link",{name:"Otaq QR-lərini toplu çap et"}).click();
  await admin.getByRole("heading",{name:"Otaq QR kodlarını çap et"}).waitFor({timeout:20000});
  assert.match(await admin.locator("body").innerText(),/CI Hotel Alpha/);
  assert.doesNotMatch(await admin.locator("body").innerText(),/CI Hotel Beta/);
  await admin.getByRole("button",{name:"Bu səhifəni çap et"}).waitFor({state:"visible"});
  await admin.locator('[data-print-room="101"] img').waitFor({state:"visible",timeout:30000});
  const qr=await admin.locator('[data-print-room="101"] img').getAttribute("src");
  assert.match(qr??"",/^data:image\/png;base64,/);
  alphaQrImage=qr??"";
  assert.equal(await admin.getByRole("button",{name:"Bu səhifəni çap et"}).isEnabled(),true);
  assert.doesNotMatch(await admin.locator("body").innerText(),/\?t=/);
  const req=await guest.goto(BASE+"/hotel-admin/rooms/print");
  // Unauthenticated guests are redirected to the login page, not shown QR data.
  assert.ok(req?.status()===200||req?.status()===307||req?.status()===308);
  assert.equal(await guest.locator('[data-print-room]').count(),0);
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
  await guest.getByRole("heading",{name:"CI Airport Pickup"}).waitFor({timeout:20000});
  await guest.getByRole("heading",{name:"CI Spa Massage"}).waitFor({timeout:20000});
  // A streamed server heading can precede React hydration on slower/mobile
  // engines. Wait for the client-generated UUID before changing controlled inputs.
  await guest.waitForFunction(()=>{
   const id=document.querySelector('input[name="requestId"]')?.value;
   return typeof id==="string"&&id.length===36;
  },null,{timeout:20000});
  const controls=guest.locator('input[type="number"]');
  assert.equal(await controls.count(),4);
  await controls.nth(0).fill("2");
  await guest.waitForFunction(()=>{
    const raw=document.querySelector('input[name="items"]')?.value||"[]";
    try{const x=JSON.parse(raw);return x.length===1&&x[0].quantity===2;}catch{return false;}
  },null,{timeout:15000});
  await controls.nth(1).fill("1");
  await guest.waitForFunction(()=>{
    const raw=document.querySelector('input[name="items"]')?.value||"[]";
    try{
     const x=JSON.parse(raw);
     return x.length===2&&x.some(v=>v.quantity===2)&&x.some(v=>v.quantity===1);
    }catch{return false;}
  },null,{timeout:15000});
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
   await panel.goto(BASE+"/hotel-admin/panel/spa");
   await panel.getByText("Hələ müraciət yoxdur.").waitFor({timeout:20000});
   await panel.goto(BASE+"/hotel-admin/panel/transfer");
   await panel.getByText("Hələ müraciət yoxdur.").waitFor({timeout:20000});
   await panel.goto(BASE+"/hotel-admin/rooms/print");
   await panel.locator('[data-print-room="101"] img').waitFor({state:"visible",timeout:30000});
   assert.match(await panel.locator("body").innerText(),/CI Hotel Beta/);
   assert.doesNotMatch(await panel.locator("body").innerText(),/CI Hotel Alpha/);
   const bQr=await panel.locator('[data-print-room="101"] img').getAttribute("src");
   assert.ok(bQr&&bQr!==alphaQrImage);
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
  assert.ok(report.csv.startsWith("\uFEFFsep=;\r\n"));
  assert.match(report.csv,/"Otelin adı";"Otaq №"/);
  assert.match(report.csv,/Daxili təsdiq/);
  assert.match(report.csv,/13,00/);
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
  // Moving to emergency OUT_OF_SERVICE must not clear the pending charge,
  // and must not allow an OUT_OF_SERVICE -> VACANT bypass.
  await roomCard.locator('select[name="status"]').selectOption("OUT_OF_SERVICE");
  await roomCard.getByRole("button",{name:"Yadda saxla"}).click();
  for(let i=0;i<50;i++){
   const state=await db.hotelRoom.findUniqueOrThrow({where:{id:room.id}});
   if(state.status==="OUT_OF_SERVICE")break;
   await new Promise(done=>setTimeout(done,200));
  }
  await admin.goto(BASE+"/hotel-admin");
  const outOfService=admin.locator("article").filter({
   has:admin.getByRole("heading",{name:"Otaq № 101"})
  });
  assert.equal(await outOfService.locator('select[name="status"]').inputValue(),"OUT_OF_SERVICE");
  assert.notEqual(await outOfService.locator('option[value="VACANT"]').getAttribute("disabled"),null);
  await outOfService.locator('select[name="status"]').selectOption("OCCUPIED");
  await outOfService.getByRole("button",{name:"Yadda saxla"}).click();
  for(let i=0;i<50;i++){
   const state=await db.hotelRoom.findUniqueOrThrow({where:{id:room.id}});
   if(state.status==="OCCUPIED")break;
   await new Promise(done=>setTimeout(done,200));
  }

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
  const audit=await db.hotelRoomStatusEvent.findMany({
   where:{hotelId:a.id,roomId:room.id},orderBy:[{createdAt:"asc"},{id:"asc"}],
  });
  assert.equal(audit.length,3);
  assert.deepEqual(audit.map(e=>[e.fromStatus,e.toStatus,e.qrRotated]),[
   ["OCCUPIED","OUT_OF_SERVICE",true],
   ["OUT_OF_SERVICE","OCCUPIED",false],
   ["OCCUPIED","VACANT",true],
  ]);
  assert.equal(await db.hotelRoomStatusEvent.count({where:{hotelId:b.id}}),0);
  await admin.goto(BASE+"/hotel-admin/rooms/history");
  await admin.getByRole("heading",{name:/Otaq status tarixçəsi/}).waitFor({timeout:20000});
  assert.equal(await admin.locator("[data-room-status-event]").count(),3);
  assert.doesNotMatch(await admin.locator("body").innerText(),/CI Hotel Beta/);
  await guest.goto(BASE+"/hotel-admin/rooms/history");
  assert.equal(await guest.locator("[data-room-status-event]").count(),0);
  const response=await fetch(guestUrl);
  assert.ok(response.status===200||response.status===404);
  const html=await response.text();
  assert.doesNotMatch(html,/CI Hotel Soup|CI Hotel Towel/);
 });
 await t.test("SPA and transfer guest order split, managers route, staff cannot cross departments",async()=>{
  // The first stay has checked out, so re-occupy using the manager UI and use the NEW QR.
  await admin.goto(BASE+"/hotel-admin");
  const card=admin.locator("article").filter({has:admin.getByRole("heading",{name:"Otaq № 101"})});
  await card.locator('select[name="status"]').selectOption("OCCUPIED");
  await card.getByRole("button",{name:"Yadda saxla"}).click();
  let current;
  for(let i=0;i<50;i++){
   current=await db.hotelRoom.findUniqueOrThrow({where:{id:room.id}});
   if(current.status==="OCCUPIED")break;
   await new Promise(done=>setTimeout(done,200));
  }
  assert.equal(current?.status,"OCCUPIED");
  const secondQr=hotelRoomToken(process.env.ADMIN_SESSION_SECRET,a.id,room.id,current.qrNonce);
  await guest.goto(BASE+"/hotel/"+a.slug+"/room/101?t="+secondQr);
  await guest.getByRole("heading",{name:"CI Airport Pickup"}).waitFor({timeout:20000});
  await guest.getByRole("heading",{name:"CI Spa Massage"}).waitFor({timeout:20000});
  await guest.waitForFunction(()=>document.querySelector('input[name="requestId"]')?.value?.length===36);
  const inputs=guest.locator('input[type="number"]');
  assert.equal(await inputs.count(),4);
  await inputs.nth(2).fill("1"); // TRANSFER
  await guest.waitForFunction(()=>{
   try{const x=JSON.parse(document.querySelector('input[name="items"]')?.value||"[]");
    return x.length===1&&x[0].quantity===1;}catch{return false;}
  });
  await inputs.nth(3).fill("1"); // SPA
  await guest.waitForFunction(()=>{
   try{const x=JSON.parse(document.querySelector('input[name="items"]')?.value||"[]");
    return x.length===2&&x.every(i=>i.quantity===1);}catch{return false;}
  });
  await guest.getByRole("button",{name:"Otaq hesabına sifariş göndər"}).click();
  await guest.waitForURL(/\/hotel\/.*\/track\//,{timeout:20000});
  const secondRequestId=new URL(guest.url()).pathname.split("/").pop();
  const secondRequest=await db.hotelGuestRequest.findUniqueOrThrow({
   where:{clientRequestId:secondRequestId},
   include:{orders:{include:{items:true}}},
  });
  assert.equal(secondRequest.hotelId,a.id);
  assert.deepEqual(secondRequest.orders.map(o=>o.department).sort(),["SPA","TRANSFER"]);
  assert.deepEqual(secondRequest.orders.map(o=>o.total.toFixed(2)).sort(),["18.00","40.00"]);
  const chargeCount=await db.hotelRoomCharge.count({
   where:{hotelId:a.id,orderId:{in:secondRequest.orders.map(o=>o.id)},status:"PENDING"}
  });
  assert.equal(chargeCount,2);
  assert.equal(await db.hotelOrder.count({where:{hotelId:b.id,requestId:secondRequest.id}}),0);

  await admin.goto(BASE+"/hotel-admin/panel/transfer");
  await admin.getByText("CI Airport Pickup").waitFor({timeout:20000});
  assert.doesNotMatch(await admin.locator("body").innerText(),/CI Spa Massage/);
  await admin.goto(BASE+"/hotel-admin/panel/spa");
  await admin.getByText("CI Spa Massage").waitFor({timeout:20000});
  assert.doesNotMatch(await admin.locator("body").innerText(),/CI Airport Pickup/);

  const transferPin="643218",username="ci-transfer-"+randomUUID().slice(0,7);
  await db.hotelStaff.create({data:{
   hotelId:a.id,username,name:"CI Transfer Operator",pinCode:await hash(transferPin),
   department:"TRANSFER",
  }});
  const ctx=await browser.newContext({extraHTTPHeaders:{"x-vercel-forwarded-for":"127.0.0.1"}});
  try{
   const staffPage=await ctx.newPage();
   await staffPage.goto(BASE+"/hotel-staff");
   await staffPage.locator('input[name="slug"]').fill(a.slug);
   await staffPage.locator('input[name="username"]').fill(username);
   await staffPage.locator('input[name="pin"]').fill(transferPin);
   await staffPage.getByRole("button",{name:"Daxil ol"}).click();
   await staffPage.waitForURL(/\/hotel-admin\/panel\/transfer/,{timeout:20000});
   await staffPage.getByText("CI Airport Pickup").waitFor({timeout:20000});
   const statuses=await staffPage.evaluate(async()=>{
    const transfer=await fetch("/hotel-admin/notifications?department=TRANSFER");
    const spa=await fetch("/hotel-admin/notifications?department=SPA");
    return [transfer.status,spa.status];
   });
   assert.deepEqual(statuses,[200,403]);
   await staffPage.goto(BASE+"/hotel-admin/panel/spa");
   assert.doesNotMatch(await staffPage.locator("body").innerText(),/CI Spa Massage/);
  }finally{await ctx.close();}
 });

});
