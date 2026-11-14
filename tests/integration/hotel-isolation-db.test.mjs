import test from "node:test";
import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {randomUUID} from "node:crypto";
const ephemeral=process.env.QR_MENU_EPHEMERAL_DB_TEST==="true" &&
 /(?:127\.0\.0\.1|localhost)/.test(process.env.DATABASE_URL??"");
const t=ephemeral?test:test.skip;
t("Hotel rows and requests are isolated by hotelId on the disposable DB",async()=>{
 const prisma=new PrismaClient();
 const a=randomUUID().slice(0,10),b=randomUUID().slice(0,10);
 try{
  const [ha,hb]=await Promise.all([
   prisma.hotel.create({data:{name:"CI A",slug:"ci-hotel-a-"+a,phone:"0123456",pinCode:"ci",
    roomCount:1,rooms:{create:{number:"101"}}}}),
   prisma.hotel.create({data:{name:"CI B",slug:"ci-hotel-b-"+b,phone:"0123456",pinCode:"ci",
    roomCount:1,rooms:{create:{number:"101"}}}}),
  ]);
  const [ra,rb]=await Promise.all([
   prisma.hotelRoom.findFirstOrThrow({where:{hotelId:ha.id,number:"101"}}),
   prisma.hotelRoom.findFirstOrThrow({where:{hotelId:hb.id,number:"101"}}),
  ]);
  assert.notEqual(ra.id,rb.id);
  assert.equal(await prisma.hotelRoom.count({where:{hotelId:hb.id,id:ra.id}}),0);
  await prisma.hotelRoomStatusEvent.create({data:{
   hotelId:ha.id,roomId:ra.id,fromStatus:"VACANT",toStatus:"OCCUPIED",
   qrRotated:false,actor:"HOTEL_MANAGER",
  }});
  assert.equal(await prisma.hotelRoomStatusEvent.count({where:{hotelId:ha.id}}),1);
  assert.equal(await prisma.hotelRoomStatusEvent.count({where:{hotelId:hb.id}}),0);
  const service=await prisma.hotelService.create({data:{
   hotelId:ha.id,category:"ROOM_SERVICE",department:"HOUSEKEEPING",name:"Test towel",price:"2.00",
  }});
  assert.equal(await prisma.hotelService.count({where:{hotelId:hb.id,id:service.id}}),0);
  const transfer=await prisma.hotelService.create({data:{
   hotelId:ha.id,category:"TRANSFER",department:"TRANSFER",name:"CI pickup",price:"20.00",
  }});
  const spa=await prisma.hotelService.create({data:{
   hotelId:ha.id,category:"SPA",department:"SPA",name:"CI wellness",price:"35.00",
  }});
  assert.equal(await prisma.hotelService.count({where:{hotelId:hb.id,id:{in:[transfer.id,spa.id]}}}),0);
  const req=await prisma.hotelGuestRequest.create({data:{
   hotelId:ha.id,roomId:ra.id,trackingTokenHash:"a".repeat(64),clientRequestId:randomUUID(),
   orders:{create:{hotelId:ha.id,department:"HOUSEKEEPING",total:"2.00",
      items:{create:{serviceId:service.id,name:"Test towel",quantity:1,unitPrice:"2.00",lineTotal:"2.00"}},
      events:{create:{hotelId:ha.id,toStatus:"NEW",actor:"GUEST"}},
   }},
  }});
  assert.equal(await prisma.hotelGuestRequest.count({where:{hotelId:hb.id,id:req.id}}),0);
  assert.equal(await prisma.hotelOrder.count({where:{hotelId:hb.id,requestId:req.id}}),0);
  assert.equal(await prisma.hotelOrder.count({where:{hotelId:ha.id,requestId:req.id}}),1);
  const order=await prisma.hotelOrder.findFirstOrThrow({where:{hotelId:ha.id,requestId:req.id}});
  assert.equal((await prisma.hotelOrder.updateMany({where:{hotelId:hb.id,id:order.id},data:{status:"ACCEPTED"}})).count,0);
  assert.equal((await prisma.hotelOrder.updateMany({where:{hotelId:ha.id,id:order.id,status:"NEW"},data:{status:"ACCEPTED"}})).count,1);
  assert.equal((await prisma.hotelOrder.updateMany({where:{hotelId:ha.id,id:order.id,status:"NEW"},data:{status:"ACCEPTED"}})).count,0);
  await prisma.hotel.delete({where:{id:ha.id}});
  await prisma.hotel.delete({where:{id:hb.id}});
 }finally{await prisma.$disconnect();}
});
