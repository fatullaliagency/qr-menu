import {Suspense} from "react";
import {notFound} from "next/navigation";
import {connection} from "next/server";
import {db} from "@/app/lib/db";
import {hotelModuleEnabled,hotelDepartmentLabels} from "@/app/lib/hotel-validation";
import {verifyHotelTrackingToken} from "@/app/lib/hotel-security";
import LiveHotelStatus from "./LiveHotelStatus";
export const metadata={title:"Otel sifarişini izlə",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function HotelTrackPage(props:{
 params:Promise<{slug:string;id:string}>;searchParams:Promise<{t?:string|string[]}>
}){
 return <Suspense fallback={<main className="p-8">Sifariş yüklənir...</main>}><TrackContent {...props}/></Suspense>;
}
async function TrackContent({params,searchParams}:{
 params:Promise<{slug:string;id:string}>;searchParams:Promise<{t?:string|string[]}>
}){
 if(!hotelModuleEnabled())notFound();
 await connection();
 const [{slug,id},query]=await Promise.all([params,searchParams]);
 const t=typeof query.t==="string"?query.t:"";
 const hotel=await db.hotel.findUnique({where:{slug},select:{id:true,name:true}});
 if(!hotel)notFound();
 const request=await db.hotelGuestRequest.findUnique({
  where:{clientRequestId:id},include:{
   room:{select:{number:true}},
   orders:{orderBy:{createdAt:"asc"},include:{items:{select:{id:true,name:true,quantity:true}}}},
  },
 });
 if(!request||request.hotelId!==hotel.id||!verifyHotelTrackingToken(t,request.trackingTokenHash))notFound();
 return <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
   <div className="mx-auto max-w-2xl space-y-5">
     <header className="rounded-xl bg-white p-5">
       <h1 className="text-2xl font-bold">{hotel.name} · Sifariş izləmə</h1>
       <p className="mt-2">Otaq № {request.room.number}</p>
     </header>
     <LiveHotelStatus token={t} initial={request.orders.map(o=>({
       id:o.id,department:o.department,status:o.status,updatedAt:o.updatedAt.toISOString(),
     }))}/>
     {request.orders.map(order=><section key={order.id} className="rounded-xl bg-white p-5">
       <h2 className="font-bold">{hotelDepartmentLabels[order.department]}</h2>
       <ul className="mt-3 space-y-1 text-sm">
         {order.items.map(item=><li key={item.id}>{item.name} × {item.quantity}</li>)}
       </ul>
       <p className="mt-2 font-semibold">{order.total.toString()} ₼</p>
       <p className="mt-1 text-xs text-zinc-500">Otaq hesabına yazılmaq üçün otelin təsdiqini gözləyir.</p>
     </section>)}
   </div>
 </main>;
}
