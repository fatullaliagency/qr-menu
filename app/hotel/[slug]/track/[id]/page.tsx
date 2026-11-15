import {Suspense} from "react";
import Link from "next/link";
import {HOTEL_GUEST_LANGUAGES,hotelGuestLang,hotelGuestText,hotelGuestPrice,hotelGuestAznPrice,hotelGuestServiceLabel} from "@/app/lib/hotel-guest-i18n";
import {notFound} from "next/navigation";
import {connection} from "next/server";
import {db} from "@/app/lib/db";
import {hotelModuleEnabled} from "@/app/lib/hotel-validation";
import {verifyHotelTrackingToken} from "@/app/lib/hotel-security";
import LiveHotelStatus from "./LiveHotelStatus";
export const metadata={title:"Otel sifarişini izlə",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function HotelTrackPage(props:{
 params:Promise<{slug:string;id:string}>;searchParams:Promise<{t?:string|string[];lang?:string|string[]}>
}){
 return <Suspense fallback={<main className="p-8">Sifariş yüklənir...</main>}><TrackContent {...props}/></Suspense>;
}
async function TrackContent({params,searchParams}:{
 params:Promise<{slug:string;id:string}>;searchParams:Promise<{t?:string|string[];lang?:string|string[]}>
}){
 if(!hotelModuleEnabled())notFound();
 await connection();
 const [{slug,id},query]=await Promise.all([params,searchParams]);
 const t=typeof query.t==="string"?query.t:"";
 const lang=hotelGuestLang(query.lang);
 const copy=hotelGuestText[lang];
 const hotel=await db.hotel.findUnique({where:{slug},select:{id:true,name:true}});
 if(!hotel)notFound();
 const request=await db.hotelGuestRequest.findUnique({
  where:{clientRequestId:id},include:{
   room:{select:{number:true}},
   orders:{orderBy:{createdAt:"asc"},include:{items:{select:{id:true,name:true,quantity:true,serviceId:true}}}},
  },
 });
 if(!request||request.hotelId!==hotel.id||!verifyHotelTrackingToken(t,request.trackingTokenHash))notFound();
 const serviceIds=request.orders.flatMap(order=>order.items.map(item=>item.serviceId));
 const translatedServices=await db.hotelService.findMany({
  where:{hotelId:hotel.id,id:{in:serviceIds}},
  select:{id:true,name:true,nameEn:true,nameRu:true,description:true,descriptionEn:true,descriptionRu:true}
 });
 const nameByService=new Map(translatedServices.map(s=>[s.id,s]));
 return <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
   <div className="mx-auto max-w-2xl space-y-5">
     <header className="rounded-xl bg-white p-5">
       <h1 className="text-2xl font-bold">{hotel.name} · {copy.tracking}</h1>
       <p className="mt-2">{copy.room} {request.room.number}</p>
     </header>
     <nav aria-label="Language / Dil / Язык" className="flex flex-wrap gap-2 rounded-xl bg-white p-3">
      {HOTEL_GUEST_LANGUAGES.map(choice=><Link key={choice}
        aria-current={choice===lang?"page":undefined}
        href={"/hotel/"+encodeURIComponent(slug)+"/track/"+encodeURIComponent(id)+"?t="+encodeURIComponent(t)+"&lang="+choice}
        className={"rounded-lg px-4 py-2 text-sm font-semibold "+(choice===lang?"bg-emerald-800 text-white":"bg-zinc-100 text-zinc-800")}>
        {hotelGuestText[choice].label}
       </Link>)}
     </nav>
     <LiveHotelStatus token={t} lang={lang} initial={request.orders.map(o=>({
       id:o.id,department:o.department,status:o.status,updatedAt:o.updatedAt.toISOString(),
     }))}/>
     {request.orders.map(order=><section key={order.id} className="rounded-xl bg-white p-5">
       <h2 className="font-bold">{copy.department[order.department]}</h2>
       <ul className="mt-3 space-y-1 text-sm">
         {order.items.map(item=><li key={item.id}>
          {hotelGuestServiceLabel(nameByService.get(item.serviceId)??{name:item.name},lang).name} × {item.quantity}
         </li>)}
       </ul>
       <p className="mt-2 font-semibold">{hotelGuestPrice(Number(order.total),lang)}</p>
       {lang!=="az"&&<p className="mt-1 text-xs text-zinc-600">{copy.originalPrice} {hotelGuestAznPrice(Number(order.total))}</p>}
       <p className="mt-1 text-xs text-zinc-500">{copy.chargeNote}</p>
     </section>)}
     {lang!=="az"&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{copy.exchangeNote} {copy.currencyNote}</p>}
   </div>
 </main>;
}
