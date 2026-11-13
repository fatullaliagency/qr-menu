import { randomUUID, createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { hotelRoomStayKey } from "../app/lib/hotel-stay.ts";

const DATABASE="postgresql://postgres:postgres@127.0.0.1:5432/qr_hotel_ci";
if(process.env.QR_MENU_EPHEMERAL_DB_TEST!=="true" ||
   process.env.DATABASE_URL!==DATABASE ||
   process.env.ENABLE_HOTEL_MODULE!=="true")
 throw new Error("Hotel backup fixtures must only be created in disposable CI.");
const db=new PrismaClient();
try{
 const stamp=randomUUID(),hotel=await db.hotel.create({data:{
  name:"CI hotel backup specimen",slug:"ci-hotel-restore-"+stamp,
  phone:"+994501234567",pinCode:"test-only-not-a-real-pin",roomCount:1,
 }});
 const room=await db.hotelRoom.create({data:{
  hotelId:hotel.id,number:"101",status:"OCCUPIED",
 }});
 const service=await db.hotelService.create({data:{
  hotelId:hotel.id,name:"CI meal",category:"FOOD",department:"KITCHEN",
  price:new Prisma.Decimal("13.00"),
 }});
 await db.hotelStaff.create({data:{
  hotelId:hotel.id,username:"chef-ci",name:"Kitchen CI",
  pinCode:"test-only-not-a-real-pin",department:"KITCHEN",
 }});
 const request=await db.hotelGuestRequest.create({data:{
  hotelId:hotel.id,roomId:room.id,clientRequestId:randomUUID(),
  trackingTokenHash:createHash("sha256").update(stamp).digest("hex"),
 }});
 const order=await db.hotelOrder.create({data:{
  hotelId:hotel.id,requestId:request.id,department:"KITCHEN",
  status:"COMPLETED",total:new Prisma.Decimal("13.00"),note:"CI backup",
 }});
 await db.hotelOrderItem.create({data:{
  orderId:order.id,serviceId:service.id,name:"CI meal",quantity:1,
  unitPrice:new Prisma.Decimal("13.00"),lineTotal:new Prisma.Decimal("13.00"),
 }});
 await db.hotelOrderEvent.createMany({data:[
  {hotelId:hotel.id,orderId:order.id,toStatus:"NEW",actor:"GUEST"},
  {hotelId:hotel.id,orderId:order.id,fromStatus:"DISPATCHED",toStatus:"COMPLETED",actor:"HOTEL_ADMIN"},
 ]});
 const charge=await db.hotelRoomCharge.create({data:{
  hotelId:hotel.id,roomId:room.id,orderId:order.id,
  stayKey:hotelRoomStayKey(hotel.id,room.id,room.qrNonce),
  amount:new Prisma.Decimal("13.00"),
  status:"APPROVED",approvedBy:"HOTEL_MANAGER",approvedAt:new Date(),
 }});
 await db.hotelRoomChargeEvent.createMany({data:[
  {hotelId:hotel.id,chargeId:charge.id,toStatus:"PENDING",actor:"GUEST"},
  {hotelId:hotel.id,chargeId:charge.id,fromStatus:"PENDING",toStatus:"APPROVED",actor:"HOTEL_MANAGER"},
 ]});
 console.log("Hotel backup fixture created in disposable CI database.");
}finally{await db.$disconnect();}
