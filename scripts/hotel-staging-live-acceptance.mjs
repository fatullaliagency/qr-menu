/**
 * Preview-only hotel database acceptance in local production Next HTTP runtime. Temporary fixtures auto-delete.
 * Never logs database host, PINs, QR bearer or tracking tokens.
 */
import assert from "node:assert/strict";
import { randomBytes,randomInt,randomUUID,scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import {PrismaClient} from "@prisma/client";
import {hotelRoomToken,verifyHotelRoomToken,hotelTrackingTokenFromRequest,hashHotelTrackingToken} from "../app/lib/hotel-security.ts";
import {hotelRoomStayKey,canReleaseHotelRoomWithCharges,shouldRotateHotelRoomToken} from "../app/lib/hotel-stay.ts";

const allowedProject="prj_2AX2rvep2HL0X0hqjKZDuurYHHLy";
const allowedDomain="http://127.0.0.1:3199"; // Local production Next runtime; Vercel Preview itself is SSO protected.
if(process.env.VERCEL_ENV!=="preview"||
   (process.env.VERCEL_PROJECT_ID && process.env.VERCEL_PROJECT_ID!==allowedProject)||
   (process.env.VERCEL_GIT_COMMIT_REF && process.env.VERCEL_GIT_COMMIT_REF!=="feature/hotel-module-v1")||
   process.env.HOTEL_LIVE_ACCEPTANCE_APPROVAL!=="ISOLATED_HOTEL_PREVIEW_ONLY"||
   process.env.ENABLE_HOTEL_MODULE!=="true"||
   process.env.ENABLE_WEB_ORDERS==="true"||
   !process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_SESSION_SECRET.length<32)
  throw new Error("HOTEL_LIVE_ACCEPTANCE_DENIED: preview-only conditions failed.");

const db=new PrismaClient({log:[]});
const ids=[];
let server;
const scrypt=promisify(scryptCallback);
const secret=process.env.ADMIN_SESSION_SECRET;
const ref=randomUUID().slice(0,12);
const pinHash=async()=>{const pin=Array.from({length:12},()=>String(randomInt(10))).join("");const salt=randomBytes(16);const key=await scrypt(pin,salt,64);return "scrypt$v1$"+salt.toString("hex")+"$"+key.toString("hex");};
let checks=0,stage="starting";
const check=(name,yes)=>{if(!yes)console.error("HOTEL_LIVE_ASSERTION_FAILED: "+name);assert.ok(yes,name);checks++;};
const fetchHtml=async url=>{
 const r=await fetch(url,{redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(25000)});
 return {status:r.status,body:await r.text()};
};
try{
 stage="starting Next production HTTP server";
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p","3199"],{
  env:process.env,stdio:["ignore","pipe","pipe"]
 });
 // Drain output without writing it to build logs, which may contain private request information.
 server.stdout?.on("data",()=>{});
 server.stderr?.on("data",()=>{});
 let serverReady=false;
 for(let i=0;i<90;i++){
  if(server.exitCode!==null)break;
  try{
   const response=await fetch(allowedDomain+"/hotel-admin",{signal:AbortSignal.timeout(1000)});
   if(response.status===200){serverReady=true;break;}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 check("Next.js production runtime starts",serverReady);
 stage="database metadata";
 const meta=await db.$queryRawUnsafe("SELECT current_database() AS db, (SELECT COUNT(*)::integer FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables");
 check("database identity",meta[0]?.db==="postgres"||meta[0]?.db==="qr_menu_hotel_staging");
 check("schema migrated",meta[0]?.tables>=8);
 stage="hotel fixture creation";
 const a=await db.hotel.create({data:{name:"QA Otel Alfa "+ref,slug:"qa-alfa-"+ref,phone:"+994500000001",pinCode:await pinHash(),roomCount:1,rooms:{create:{number:"101",status:"OCCUPIED"}}}});ids.push(a.id);
 const b=await db.hotel.create({data:{name:"QA Otel Beta "+ref,slug:"qa-beta-"+ref,phone:"+994500000002",pinCode:await pinHash(),roomCount:1,rooms:{create:{number:"101",status:"OCCUPIED"}}}});ids.push(b.id);
 const [ra,rb]=await Promise.all([db.hotelRoom.findFirstOrThrow({where:{hotelId:a.id,number:"101"}}),db.hotelRoom.findFirstOrThrow({where:{hotelId:b.id,number:"101"}})]);
 check("same number / different tenant room",ra.id!==rb.id);
 const categories=[
  ["FOOD","KITCHEN","QA Yemək",6.50],
  ["ROOM_SERVICE","HOUSEKEEPING","QA Dəsmal",0],
  ["EXTRA","RECEPTION","QA Resepsiyon",4],
  ["TRANSFER","TRANSFER","QA Transfer",18],
  ["SPA","SPA","QA SPA",40]
 ];
 stage="service fixture creation";
 const services=await Promise.all(categories.map(([category,department,name,price])=>db.hotelService.create({
  data:{hotelId:a.id,category,department,name:name+" "+ref,price}
 })));
 const token=hotelRoomToken(secret,a.id,ra.id,ra.qrNonce);
 stage="hosted QR / tenant isolation";
 const alpha=await fetchHtml(allowedDomain+"/hotel/"+a.slug+"/room/101?t="+token);
 check("local Next production Alpha room visible",alpha.status===200&&alpha.body.includes(a.name));
 for(const s of services)check("live menu includes "+s.category,alpha.body.includes(s.name));
 const cross=await fetchHtml(allowedDomain+"/hotel/"+b.slug+"/room/101?t="+token);
 check("cross-hotel QR denied",!cross.body.includes(b.name)&&!cross.body.includes("QA Transfer "+ref));
 const invalid=await fetchHtml(allowedDomain+"/hotel/"+a.slug+"/room/101?t=invalid");
 check("invalid QR denied",!invalid.body.includes("QA Yemək "+ref));

 const requestId=randomUUID(),tracking=hotelTrackingTokenFromRequest(secret,requestId);
 const stayKey=hotelRoomStayKey(a.id,ra.id,ra.qrNonce);
 stage="five department order and folio fixture";
 const req=await db.hotelGuestRequest.create({data:{
  hotelId:a.id,roomId:ra.id,clientRequestId:requestId,trackingTokenHash:hashHotelTrackingToken(tracking),
  orders:{create:services.map(s=>({
   hotelId:a.id,department:s.department,total:s.price,roomCharge:true,
   items:{create:{serviceId:s.id,name:s.name,quantity:1,unitPrice:s.price,lineTotal:s.price}},
   charge:{create:{hotelId:a.id,roomId:ra.id,stayKey,amount:s.price,
    events:{create:{hotelId:a.id,toStatus:"PENDING",actor:"GUEST"}}}},
   events:{create:{hotelId:a.id,toStatus:"NEW",actor:"GUEST"}}
  }))}
 }});
 const orders=await db.hotelOrder.findMany({where:{requestId:req.id},include:{charge:true,items:true,events:true}});
 check("five departments",orders.length===5&&new Set(orders.map(o=>o.department)).size===5);
 check("five pending folio entries",orders.every(o=>o.charge?.status==="PENDING"));
 check("other hotel cannot read order",await db.hotelOrder.count({where:{hotelId:b.id,requestId:req.id}})===0);
 check("other hotel cannot change order",(await db.hotelOrder.updateMany({where:{hotelId:b.id,id:orders[0].id},data:{status:"ACCEPTED"}})).count===0);
 check("unpaid folio blocks checkout",!canReleaseHotelRoomWithCharges("OCCUPIED","VACANT",5));
 stage="hosted tracking";
 const trackUrl=allowedDomain+"/hotel/"+a.slug+"/track/"+requestId+"/status";
 const good=await fetch(trackUrl+"?t="+tracking,{cache:"no-store",signal:AbortSignal.timeout(25000)});
 const data=await good.json();
 check("Next HTTP tracking displays five departments",good.status===200&&data.orders?.length===5);
 const denied=await fetch(trackUrl,{cache:"no-store",signal:AbortSignal.timeout(25000)});
 check("tracking needs bearer token",denied.status===404);
 const other=await fetch(allowedDomain+"/hotel/"+b.slug+"/track/"+requestId+"/status?t="+tracking,{cache:"no-store",signal:AbortSignal.timeout(25000)});
 check("tracking tenant isolation",other.status===404);
 const first=orders[0];
 await db.hotelOrder.update({where:{id:first.id},data:{status:"ACCEPTED",events:{create:{hotelId:a.id,fromStatus:"NEW",toStatus:"ACCEPTED",actor:"HOTEL_MANAGER"}}}});
 const changed=await fetch(trackUrl+"?t="+tracking,{cache:"no-store",signal:AbortSignal.timeout(25000)});
 const after=await changed.json();
 check("Next HTTP tracking displays status change",changed.status===200&&after.orders.some(o=>o.id===first.id&&o.status==="ACCEPTED"));
 check("request remains idempotent",await db.hotelGuestRequest.count({where:{clientRequestId:requestId}})===1);
 stage="folio approval checkout and QR rotation";
 for(const order of orders)await db.hotelRoomCharge.update({
  where:{orderId:order.id},data:{status:"APPROVED",approvedBy:"HOTEL_MANAGER",approvedAt:new Date(),
   events:{create:{hotelId:a.id,fromStatus:"PENDING",toStatus:"APPROVED",actor:"HOTEL_MANAGER"}}}
 });
 const pending=await db.hotelRoomCharge.count({where:{hotelId:a.id,roomId:ra.id,status:"PENDING"}});
 check("folios approved",pending===0);
 check("checkout allowed after approval",canReleaseHotelRoomWithCharges("OCCUPIED","VACANT",pending));
 check("checkout rotates nonce",shouldRotateHotelRoomToken("OCCUPIED","VACANT"));
 await db.hotelRoom.update({where:{id:ra.id},data:{status:"VACANT",qrNonce:randomUUID(),
  statusEvents:{create:{hotelId:a.id,fromStatus:"OCCUPIED",toStatus:"VACANT",qrRotated:true,actor:"HOTEL_MANAGER"}}}});
 const updated=await db.hotelRoom.findUniqueOrThrow({where:{id:ra.id}});
 check("old bearer invalid after checkout",!verifyHotelRoomToken(secret,a.id,ra.id,updated.qrNonce,token));
 const expired=await fetchHtml(allowedDomain+"/hotel/"+a.slug+"/room/101?t="+token);
 check("Next HTTP old QR denied",!expired.body.includes("QA Yemək "+ref));
 const audits=await db.hotelRoomStatusEvent.findMany({where:{hotelId:a.id,roomId:ra.id}});
 check("status audit recorded",audits.length===1&&audits[0].qrRotated);
 check("other hotel not checked out",(await db.hotelRoom.findUniqueOrThrow({where:{id:rb.id}})).status==="OCCUPIED");
 console.log("HOTEL_LIVE_ACCEPTANCE_PASS: "+checks+" assertions; isolated DB and local Next production HTTP QR/tracking.");
}catch{
 console.error("HOTEL_LIVE_ACCEPTANCE_FAILED_AT: "+stage+"; temporary fixtures will be removed.");
 process.exitCode=1;
}finally{
 if(server?.exitCode===null){
  server.kill("SIGTERM");
  await Promise.race([
   new Promise(resolve=>server.once("exit",resolve)),
   new Promise(resolve=>setTimeout(resolve,2000))
  ]);
 }
 try{
  if(ids.length)await db.hotel.deleteMany({where:{id:{in:ids}}});
  const remaining=ids.length?await db.hotel.count({where:{id:{in:ids}}}):0;
  if(remaining){console.error("HOTEL_LIVE_CLEANUP_FAILED");process.exitCode=1;}
  else console.log("HOTEL_LIVE_CLEANUP_SUCCESS: temporary test hotels deleted.");
 }catch{
  console.error("HOTEL_LIVE_CLEANUP_FAILED");
  process.exitCode=1;
 }
 await db.$disconnect().catch(()=>{});
}
