"use server";
import {createHmac} from "node:crypto";
import {isIP} from "node:net";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {db} from "@/app/lib/db";
import {getHotelSession, createHotelSession,deleteHotelSession,getHotelSecret} from "@/app/lib/hotel-auth";
import {verifyRestaurantPin} from "@/app/lib/pin-security";
import {hotelModuleEnabled,hotelCategoryDepartment,isHotelCategory,validHotelRoomNumber,hotelNextStatus,isHotelDepartment,isHotelStatus} from "@/app/lib/hotel-validation";
import {randomUUID} from "node:crypto";
import {revalidatePath} from "next/cache";
import {Prisma} from "@prisma/client";

const BAD_LOGIN="Otel və ya PİN yanlışdır.";
export async function loginHotel(form:FormData):Promise<void>{
 if(!hotelModuleEnabled()) redirect("/hotel-admin?error=disabled");
 const slug=String(form.get("slug")??"").trim();
 const pin=String(form.get("pin")??"").trim();
 if(!/^[a-z0-9-]{3,60}$/.test(slug) || !/^[0-9]{6,12}$/.test(pin)) redirect("/hotel-admin?error=login");
 const h=await headers();
 const source=h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()??"";
 const ip=isIP(source)?source:process.env.NODE_ENV!=="production"?"local-development":null;
 if(!ip) redirect("/hotel-admin?error=unavailable");
 const key=createHmac("sha256",getHotelSecret()).update("hotel-login:v1:"+slug+":"+ip).digest("hex");
 const prev=await db.adminLoginAttempt.findUnique({where:{key},select:{blockedUntil:true}});
 if(prev?.blockedUntil && prev.blockedUntil>Date.now())redirect("/hotel-admin?error=blocked");
 const hotel=await db.hotel.findUnique({where:{slug},select:{id:true,pinCode:true}});
 const valid=Boolean(hotel && await verifyRestaurantPin(pin,hotel.pinCode));
 const result=await db.$transaction(async(tx)=>{
   await tx.$executeRaw`INSERT INTO public."AdminLoginAttempt" ("key","failedAttempts","blockedUntil","updatedAt") VALUES (${key},0,NULL,CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING`;
   const records=await tx.$queryRaw<{failedAttempts:number;blockedUntil:Date|null;updatedAt:Date}[]>`SELECT "failedAttempts","blockedUntil","updatedAt" FROM public."AdminLoginAttempt" WHERE "key"=${key} FOR UPDATE`;
   const row=records[0];if(!row)return "invalid";
   const now=new Date();
   if(row.blockedUntil && row.blockedUntil>now)return "blocked";
   if(valid){await tx.adminLoginAttempt.update({where:{key},data:{failedAttempts:0,blockedUntil:null}});return "success";}
   const count=(row.blockedUntil||now.getTime()-row.updatedAt.getTime()>15*60*1000)?1:row.failedAttempts+1;
   await tx.adminLoginAttempt.update({where:{key},data:{failedAttempts:count,blockedUntil:count>=5?new Date(now.getTime()+15*60*1000):null}});
   return count>=5?"blocked":"invalid";
 });
 if(result!=="success" || !hotel)redirect("/hotel-admin?error="+(result==="blocked"?"blocked":"login"));
 await createHotelSession(hotel.id);
 redirect("/hotel-admin");
}
export async function logoutHotel():Promise<void>{await deleteHotelSession();redirect("/hotel-admin");}

async function managerHotelId():Promise<string>{
 if(!hotelModuleEnabled())throw new Error("Otel modulu deaktivdir.");
 const session=await getHotelSession();
 if(!session)throw new Error("Otel admin giriş tələb olunur.");
 return session.hotelId;
}
export async function addHotelRoom(form:FormData):Promise<void>{
 const hotelId=await managerHotelId();
 const number=String(form.get("number")??"").trim();
 if(!validHotelRoomNumber(number))throw new Error("Otaq nömrəsi yanlışdır.");
 await db.$transaction(async tx=>{
  await tx.hotelRoom.create({data:{hotelId,number}});
  await tx.hotel.update({where:{id:hotelId},data:{roomCount:{increment:1}}});
 });
 revalidatePath("/hotel-admin");
}
export async function setHotelRoomStatus(form:FormData):Promise<void>{
 const hotelId=await managerHotelId();
 const roomId=String(form.get("roomId")??"");
 const status=String(form.get("status")??"");
 if(!["VACANT","OCCUPIED","OUT_OF_SERVICE"].includes(status))throw new Error("Yanlış otaq statusu.");
 await db.hotelRoom.updateMany({
  where:{id:roomId,hotelId},
  data:{status:status as "VACANT"|"OCCUPIED"|"OUT_OF_SERVICE",
   ...(status==="VACANT"?{qrNonce:randomUUID()}:{}),
  },
 });
 revalidatePath("/hotel-admin");
}
export async function addHotelService(form:FormData):Promise<void>{
 const hotelId=await managerHotelId();
 const name=String(form.get("name")??"").trim();
 const description=String(form.get("description")??"").trim();
 const category=form.get("category");
 const priceRaw=String(form.get("price")??"").trim();
 if(!isHotelCategory(category)||name.length<2||name.length>120||
   description.length>500|| !/^(?:\d{1,6})(?:\.\d{1,2})?$/.test(priceRaw)) throw new Error("Xidmət məlumatları yanlışdır.");
 await db.hotelService.create({data:{
   hotelId,name,description:description||null,category,
   department:hotelCategoryDepartment(category),
   price:new Prisma.Decimal(priceRaw),
 }});
 revalidatePath("/hotel-admin");
}
export async function toggleHotelService(form:FormData):Promise<void>{
 const hotelId=await managerHotelId();
 const id=String(form.get("id")??"");
 const active=form.get("active")==="true";
 await db.hotelService.updateMany({where:{id,hotelId},data:{active}});
 revalidatePath("/hotel-admin");
}
export async function advanceHotelOrder(form:FormData):Promise<void>{
 const hotelId=await managerHotelId();
 const id=String(form.get("id")??"");
 const department=form.get("department");
 if(!isHotelDepartment(department) || !/^[a-z0-9_-]{8,100}$/i.test(id))throw new Error("Yanlış sifariş.");
 await db.$transaction(async tx=>{
  const order=await tx.hotelOrder.findFirst({
   where:{id,hotelId,department},select:{status:true},
  });
  if(!order || !isHotelStatus(order.status))throw new Error("Sifariş tapılmadı.");
  const next=hotelNextStatus(order.status);
  if(!next)throw new Error("Sifariş tamamlanıb.");
  const updated=await tx.hotelOrder.updateMany({
   where:{id,hotelId,department,status:order.status},data:{status:next},
  });
  if(updated.count!==1)throw new Error("Sifariş statusu artıq dəyişdirilib.");
  await tx.hotelOrderEvent.create({data:{
   hotelId,orderId:id,fromStatus:order.status,toStatus:next,actor:"HOTEL_ADMIN",
  }});
 });
 revalidatePath("/hotel-admin/panel/"+department.toLowerCase());
 revalidatePath("/hotel-admin");
}

export async function setHotelDepartments(form:FormData):Promise<void>{
 const hotelId=await managerHotelId();
 const food=form.get("foodEnabled")==="on";
 const room=form.get("roomServiceEnabled")==="on";
 const extra=form.get("extraEnabled")==="on";
 if(!food&&!room&&!extra)throw new Error("Ən azı bir xidmət bölməsi seçilməlidir.");
 await db.hotel.update({where:{id:hotelId},data:{foodEnabled:food,roomServiceEnabled:room,extraEnabled:extra}});
 revalidatePath("/hotel-admin");
}
