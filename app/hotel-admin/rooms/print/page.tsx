import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { getHotelSecret, getHotelSession } from "@/app/lib/hotel-auth";
import { hotelModuleEnabled } from "@/app/lib/hotel-validation";
import { hotelRoomToken } from "@/app/lib/hotel-security";
import PrintRoomCodes from "./PrintRoomCodes";

export const metadata = {
 title: "Otel otaq QR-lərinin toplu çapı",
 robots: { index: false, follow: false },
 referrer: "no-referrer" as const,
};
const PAGE_SIZE = 24;
type Props={ searchParams:Promise<{page?:string|string[]}> };
export default function HotelPrintRoomsPage(props: Props){
 return <Suspense fallback={<main className="p-8">Otaq QR-ləri hazırlanır...</main>}>
  <PrintContent {...props}/>
 </Suspense>;
}
async function PrintContent({searchParams}:Props){
 if(!hotelModuleEnabled())notFound();
 const session=await getHotelSession();
 if(!session)redirect("/hotel-admin");
 const hotel=await db.hotel.findUnique({
  where:{id:session.hotelId},select:{id:true,name:true,slug:true}
 });
 if(!hotel)notFound();
 const raw=(await searchParams).page;
 if(raw!==undefined&&(typeof raw!=="string"||!/^[1-9]\d{0,4}$/.test(raw)))notFound();
 const page=raw?Number(raw):1;
 const count=await db.hotelRoom.count({where:{hotelId:hotel.id}});
 const totalPages=Math.max(1,Math.ceil(count/PAGE_SIZE));
 if(page>totalPages)notFound();
 const rooms=await db.hotelRoom.findMany({
  where:{hotelId:hotel.id},orderBy:[{number:"asc"},{id:"asc"}],
  skip:(page-1)*PAGE_SIZE,take:PAGE_SIZE,
  select:{id:true,number:true,qrNonce:true,status:true}
 });
 const secret=getHotelSecret();
 return <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-900">
  <div className="mx-auto max-w-5xl space-y-4">
   <header className="rounded-xl bg-white p-5 print:hidden">
    <Link href="/hotel-admin" className="text-sm font-medium text-blue-700 underline">← Otel admin panelinə qayıt</Link>
    <h1 className="mt-3 text-2xl font-bold">Otaq QR kodlarını çap et</h1>
    <p className="mt-2 text-sm text-zinc-600">{hotel.name} — {count} otaq, səhifə {page}/{totalPages} (hər səhifədə maksimum {PAGE_SIZE} QR)</p>
    <p className="mt-2 text-sm text-amber-900">QR giriş kodları məxfidir. Çap etdiyiniz vərəqləri yalnız uyğun otaqlara yerləşdirin. Otaq boşaldıqda əvvəlki QR-ni yenisi ilə əvəz edin.</p>
   </header>
   <PrintRoomCodes hotelName={hotel.name} slug={hotel.slug} page={page} rooms={rooms.map(room=>({
    number:room.number,status:room.status,
    token:hotelRoomToken(secret,hotel.id,room.id,room.qrNonce)
   }))}/>
   <nav className="flex justify-between rounded-xl bg-white p-4 text-sm print:hidden" aria-label="Çap səhifələri">
    {page>1?<Link href={"/hotel-admin/rooms/print?page="+(page-1)} className="font-semibold text-blue-700 underline">← Əvvəlki QR-lər</Link>:<span/>}
    {page<totalPages?<Link href={"/hotel-admin/rooms/print?page="+(page+1)} className="font-semibold text-blue-700 underline">Növbəti QR-lər →</Link>:<span/>}
   </nav>
  </div>
 </main>;
}
