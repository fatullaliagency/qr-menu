import {Suspense} from "react";
import {notFound,redirect} from "next/navigation";
import {connection} from "next/server";
import Link from "next/link";
import {db} from "@/app/lib/db";
import {getHotelSession} from "@/app/lib/hotel-auth";
import {hotelModuleEnabled,hotelDepartmentLabels,hotelStatusLabels,isHotelDepartment,hotelNextStatus} from "@/app/lib/hotel-validation";
import {advanceHotelOrder} from "../../actions";
import HotelOrderWatcher from "../../HotelOrderWatcher";
export const metadata={title:"Otel şöbə sifarişləri",robots:{index:false,follow:false}};
export default function HotelDepartmentPage(props:{
 params:Promise<{department:string}>
}){
 return <Suspense fallback={<main className="p-8">Şöbə sifarişləri yüklənir...</main>}><DepartmentContent {...props}/></Suspense>;
}
async function DepartmentContent({params}:{
 params:Promise<{department:string}>
}){
 if(!hotelModuleEnabled())notFound();
 await connection();
 const {department:raw}=await params;
 const department=raw.toUpperCase();
 if(!isHotelDepartment(department))notFound();
 const session=await getHotelSession();
 if(!session)redirect("/hotel-admin");
 const hotel=await db.hotel.findUnique({where:{id:session.hotelId},select:{name:true}});
 if(!hotel)redirect("/hotel-admin");
 const orders=await db.hotelOrder.findMany({
  where:{hotelId:session.hotelId,department},
  orderBy:[{createdAt:"desc"},{id:"desc"}],take:100,
  include:{
   request:{select:{room:{select:{number:true}}}},
   items:{select:{id:true,name:true,quantity:true}},
   events:{orderBy:{createdAt:"asc"},select:{id:true,fromStatus:true,toStatus:true,createdAt:true}},
  },
 });
 return <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
  <div className="mx-auto max-w-5xl space-y-5">
   <header className="rounded-xl bg-white p-5">
    <Link href="/hotel-admin" className="text-sm text-blue-700 underline">← Otel admin</Link>
    <h1 className="mt-2 text-2xl font-bold">{hotel.name} · {hotelDepartmentLabels[department]}</h1>
    <p className="text-sm text-zinc-500">Yalnız bu otelin {hotelDepartmentLabels[department].toLowerCase()} müraciətləri</p>
   </header>
   <HotelOrderWatcher department={department}/>
   {orders.length===0&&<p className="rounded-xl bg-white p-5">Hələ müraciət yoxdur.</p>}
   <div className="grid gap-4 md:grid-cols-2">
   {orders.map(order=><article key={order.id} className="space-y-3 rounded-xl bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-xl font-bold">Otaq № {order.request.room.number}</h2>
      <span className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-bold">{hotelStatusLabels[order.status]}</span>
    </div>
    <p className="text-xs text-zinc-500">{order.createdAt.toLocaleString("az-AZ",{timeZone:"Asia/Baku"})}</p>
    <ul className="list-inside list-disc text-sm">{order.items.map(item=><li key={item.id}>{item.name} × {item.quantity}</li>)}</ul>
    {order.note&&<p className="rounded-lg bg-zinc-50 p-3 text-sm">Qonaq qeydi: {order.note}</p>}
    <p className="font-semibold">Otaq hesabına qeyd üçün: {order.total.toString()} ₼ (təsdiq tələb edir)</p>
    {hotelNextStatus(order.status)&&<form action={advanceHotelOrder}>
      <input name="id" type="hidden" value={order.id}/>
      <input name="department" type="hidden" value={department}/>
      <button className="rounded-lg bg-emerald-800 px-4 py-2.5 font-bold text-white">
       {hotelStatusLabels[hotelNextStatus(order.status)!]} et
      </button>
    </form>}
    <details><summary className="cursor-pointer text-xs text-zinc-600">Status tarixçəsi</summary>
      <ol className="mt-2 space-y-1 text-xs text-zinc-500">
        {order.events.map(e=><li key={e.id}>{hotelStatusLabels[e.toStatus]} · {e.createdAt.toLocaleString("az-AZ",{timeZone:"Asia/Baku"})}</li>)}
      </ol>
    </details>
   </article>)}
   </div>
  </div>
 </main>;
}
