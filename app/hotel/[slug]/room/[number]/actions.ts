"use server";
import {redirect} from "next/navigation";
import {Prisma} from "@prisma/client";
import {db} from "@/app/lib/db";
import {getHotelSecret} from "@/app/lib/hotel-auth";
import {hotelModuleEnabled,parseHotelCart,validHotelRoomNumber,hotelCategoryDepartment} from "@/app/lib/hotel-validation";
import {hotelRoomToken,verifyHotelRoomToken,hotelTrackingTokenFromRequest,hashHotelTrackingToken} from "@/app/lib/hotel-security";
const MAX_CENTS=100_000_000;

export async function createHotelGuestRequest(form:FormData):Promise<void> {
 if(!hotelModuleEnabled())throw new Error("Otel modulu deaktivdir.");
 const slug=String(form.get("slug")??"").trim();
 const roomNumber=String(form.get("roomNumber")??"").trim();
 const token=form.get("roomToken");
 const requestId=String(form.get("requestId")??"");
 const note=String(form.get("note")??"").trim();
 const lines=parseHotelCart(form.get("items"));
 if(!/^[a-z0-9-]{3,60}$/.test(slug)||!validHotelRoomNumber(roomNumber)||
   !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requestId)||
   note.length>500||!lines)throw new Error("Sifariş məlumatları düzgün deyil.");
 const hotel=await db.hotel.findUnique({where:{slug},select:{id:true,foodEnabled:true,roomServiceEnabled:true,extraEnabled:true}});
 if(!hotel)throw new Error("Otel tapılmadı.");
 const room=await db.hotelRoom.findFirst({
  where:{hotelId:hotel.id,number:roomNumber},
  select:{id:true,qrNonce:true,status:true},
 });
 if(!room||room.status!=="OCCUPIED"||
   !verifyHotelRoomToken(getHotelSecret(),hotel.id,room.id,room.qrNonce,token))
  throw new Error("Otaq QR kodu etibarsızdır və ya otaq aktiv deyil.");
 const trackingToken=hotelTrackingTokenFromRequest(getHotelSecret(),requestId);
 const trackingPath=`/hotel/${encodeURIComponent(slug)}/track/${encodeURIComponent(requestId)}?t=${encodeURIComponent(trackingToken)}`;
 // Unique clientRequestId means a resubmission is not charged twice.
 const existing=await db.hotelGuestRequest.findUnique({
   where:{clientRequestId:requestId},select:{hotelId:true,roomId:true}
 });
 if(existing){
  if(existing.hotelId!==hotel.id||existing.roomId!==room.id)throw new Error("Sifariş açarı başqa otağa aiddir.");
  redirect(trackingPath);
 }
 const services=await db.hotelService.findMany({
  where:{hotelId:hotel.id,active:true,id:{in:lines.map(x=>x.serviceId)}},
  select:{id:true,name:true,price:true,category:true,department:true},
 });
 if(services.length!==lines.length)throw new Error("Seçilmiş xidmətlərdən biri aktiv deyil.");
 const lookup=new Map(services.map(x=>[x.id,x]));
 const grouped=new Map<string,{serviceId:string;name:string;quantity:number;unitPrice:Prisma.Decimal;lineTotal:Prisma.Decimal;}[]>();
 let grandCents=0;
 for(const line of lines){
  const s=lookup.get(line.serviceId);
  if(!s||!({FOOD:hotel.foodEnabled,ROOM_SERVICE:hotel.roomServiceEnabled,EXTRA:hotel.extraEnabled}[s.category])||s.department!==hotelCategoryDepartment(s.category))throw new Error("Xidmətin şöbəsi yanlışdır.");
  const cents=Math.round(Number(s.price)*100);
  const amount=cents*line.quantity;
  if(!Number.isSafeInteger(cents)||cents<0||cents>MAX_CENTS||
     !Number.isSafeInteger(amount)||amount<0||grandCents+amount>MAX_CENTS)throw new Error("Məbləğ yanlışdır.");
  grandCents+=amount;
  const items=grouped.get(s.department)??[];
  items.push({serviceId:s.id,name:s.name,quantity:line.quantity,
   unitPrice:new Prisma.Decimal(cents).div(100),
   lineTotal:new Prisma.Decimal(amount).div(100)});
  grouped.set(s.department,items);
 }
 try{
 await db.hotelGuestRequest.create({data:{
  clientRequestId:requestId,hotelId:hotel.id,roomId:room.id,
  trackingTokenHash:hashHotelTrackingToken(trackingToken),
  orders:{create:[...grouped.entries()].map(([department,items])=>({
   hotelId:hotel.id,department:department as "KITCHEN"|"HOUSEKEEPING"|"RECEPTION",
   note:note||null,total:items.reduce((sum,x)=>sum.add(x.lineTotal),new Prisma.Decimal(0)),
   roomCharge:true,
   items:{create:items},
   events:{create:{hotelId:hotel.id,toStatus:"NEW" as const,actor:"GUEST"}},
  }))},
 }});
 }catch(error){
  if(!(error instanceof Prisma.PrismaClientKnownRequestError && error.code==="P2002"))throw error;
  const replay=await db.hotelGuestRequest.findUnique({
    where:{clientRequestId:requestId},select:{hotelId:true,roomId:true}
  });
  if(!replay||replay.hotelId!==hotel.id||replay.roomId!==room.id)throw error;
 }
 redirect(trackingPath);
}
