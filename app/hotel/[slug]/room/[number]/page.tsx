import {notFound} from "next/navigation";
import {connection} from "next/server";
import {db} from "@/app/lib/db";
import {getHotelSecret} from "@/app/lib/hotel-auth";
import {hotelModuleEnabled} from "@/app/lib/hotel-validation";
import {verifyHotelRoomToken} from "@/app/lib/hotel-security";
import ClientHotelCart from "./ClientHotelCart";
export const metadata={title:"Otel qonaq xidmətləri",robots:{index:false,follow:false},referrer:"no-referrer"};
export default async function HotelGuestRoomPage({params,searchParams}:{
 params:Promise<{slug:string;number:string}>;searchParams:Promise<{t?:string|string[]}>
}){
 if(!hotelModuleEnabled())notFound();
 await connection();
 const [{slug,number},query]=await Promise.all([params,searchParams]);
 const token=typeof query.t==="string"?query.t:"";
 const hotel=await db.hotel.findUnique({
  where:{slug},select:{id:true,name:true,branchName:true,foodEnabled:true,roomServiceEnabled:true,extraEnabled:true},
 });
 if(!hotel)notFound();
 const room=await db.hotelRoom.findFirst({
  where:{hotelId:hotel.id,number},
  select:{id:true,qrNonce:true,status:true},
 });
 if(!room||!verifyHotelRoomToken(getHotelSecret(),hotel.id,room.id,room.qrNonce,token))notFound();
 const services=room.status==="OCCUPIED"? await db.hotelService.findMany({
  where:{hotelId:hotel.id,active:true,category:{in:[...(hotel.foodEnabled?["FOOD" as const]:[]),...(hotel.roomServiceEnabled?["ROOM_SERVICE" as const]:[]),...(hotel.extraEnabled?["EXTRA" as const]:[])]}},orderBy:[{category:"asc"},{name:"asc"}],
  select:{id:true,name:true,description:true,category:true,price:true},
 }):[];
 return <main className="min-h-screen bg-zinc-100 px-4 py-7 text-zinc-900">
   <div className="mx-auto max-w-2xl space-y-5">
     <header className="rounded-2xl bg-emerald-950 p-6 text-white">
       <p className="text-sm text-emerald-200">Otel · Qonaq xidmətləri</p>
       <h1 className="mt-1 text-2xl font-bold">{hotel.name}</h1>
       {hotel.branchName&&<p className="text-sm">{hotel.branchName}</p>}
       <p className="mt-3 text-lg font-semibold">Otaq № {number}</p>
     </header>
     {room.status!=="OCCUPIED"
      ?<p role="status" className="rounded-xl bg-amber-50 p-5 text-amber-950">Otaq sifarişlər üçün aktiv deyil. Resepsiyona müraciət edin.</p>
      :<ClientHotelCart slug={slug} roomNumber={number} token={token}
        services={services.map(s=>({...s,price:s.price.toString()}))}/>}
   </div>
 </main>;
}
