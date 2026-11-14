import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { getHotelSession } from "@/app/lib/hotel-auth";
import { hotelModuleEnabled } from "@/app/lib/hotel-validation";
import type { HotelRoomStatus } from "@prisma/client";

export const metadata = {
 title: "Otel otaqlarının status tarixçəsi", robots: { index: false, follow: false },
};
const PAGE_SIZE=40;
const labels:Record<HotelRoomStatus,string>={
 VACANT:"Boş",OCCUPIED:"Dolu",OUT_OF_SERVICE:"Xidmətdən kənar"
};
type Props={searchParams:Promise<{page?:string|string[]}>};
export default function HotelRoomHistoryPage(props:Props){
 return <Suspense fallback={<main className="p-8">Status tarixçəsi yüklənir...</main>}><History {...props}/></Suspense>;
}
async function History({searchParams}:Props){
 if(!hotelModuleEnabled())notFound();
 const session=await getHotelSession();
 if(!session)redirect("/hotel-admin");
 const query=await searchParams,raw=query.page;
 if(raw!==undefined&&(typeof raw!=="string"||!/^[1-9]\d{0,4}$/.test(raw)))notFound();
 const page=raw?Number(raw):1;
 const hotel=await db.hotel.findUnique({where:{id:session.hotelId},select:{id:true,name:true}});
 if(!hotel)notFound();
 const count=await db.hotelRoomStatusEvent.count({where:{hotelId:hotel.id}});
 const totalPages=Math.max(1,Math.ceil(count/PAGE_SIZE));
 if(page>totalPages)notFound();
 const events=await db.hotelRoomStatusEvent.findMany({
  where:{hotelId:hotel.id},
  orderBy:[{createdAt:"desc"},{id:"desc"}],
  skip:(page-1)*PAGE_SIZE,take:PAGE_SIZE,
  select:{id:true,fromStatus:true,toStatus:true,qrRotated:true,actor:true,createdAt:true,room:{select:{number:true}}}
 });
 return <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
  <div className="mx-auto max-w-5xl space-y-5">
   <header className="rounded-xl bg-white p-5">
    <Link href="/hotel-admin" className="text-sm text-blue-700 underline">← Otel admin paneli</Link>
    <h1 className="mt-3 text-2xl font-bold">{hotel.name} · Otaq status tarixçəsi</h1>
    <p className="mt-2 text-sm text-zinc-600">Menecerin otaq vəziyyəti dəyişiklikləri. QR tokenləri və qonaq məlumatları burada göstərilmir.</p>
    <p className="mt-2 text-xs text-zinc-500">Cəmi {count} keçid · Səhifə {page}/{totalPages}</p>
   </header>
   <div className="overflow-x-auto rounded-xl bg-white p-4">
    <table className="w-full min-w-[680px] text-left text-sm">
     <thead><tr className="border-b">
      <th className="p-3">Vaxt (Bakı)</th><th className="p-3">Otaq</th><th className="p-3">Dəyişiklik</th><th className="p-3">QR</th><th className="p-3">İcraçı</th>
     </tr></thead>
     <tbody>{events.map(e=><tr key={e.id} className="border-b last:border-0" data-room-status-event={e.id}>
      <td className="p-3">{e.createdAt.toLocaleString("az-AZ",{timeZone:"Asia/Baku"})}</td>
      <td className="p-3 font-semibold">Otaq № {e.room.number}</td>
      <td className="p-3">{e.fromStatus?labels[e.fromStatus]:"Yaradıldı"} → {labels[e.toStatus]}</td>
      <td className="p-3">{e.qrRotated?"Yeniləndi":"Dəyişmədi"}</td>
      <td className="p-3">{e.actor==="HOTEL_MANAGER"?"Otel meneceri":e.actor}</td>
     </tr>)}</tbody>
    </table>
    {events.length===0&&<p className="p-4 text-sm">Hələ otaq statusu dəyişdirilməyib.</p>}
   </div>
   <nav aria-label="Tarixçə səhifələri" className="flex items-center justify-between gap-4 rounded-xl bg-white p-4 text-sm">
    {page>1?<Link href={"/hotel-admin/rooms/history?page="+(page-1)} className="text-blue-700 underline">← Əvvəlki</Link>:<span/>}
    {page<totalPages?<Link href={"/hotel-admin/rooms/history?page="+(page+1)} className="text-blue-700 underline">Növbəti →</Link>:<span/>}
   </nav>
  </div>
 </main>;
}
