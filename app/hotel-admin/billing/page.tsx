import { Suspense } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/app/lib/db";
import { getHotelSession } from "@/app/lib/hotel-auth";
import { hotelModuleEnabled } from "@/app/lib/hotel-validation";
import { canApproveHotelRoomCharge, canVoidHotelRoomCharge } from "@/app/lib/hotel-billing-policy";
import { decideHotelRoomCharge } from "../actions";

export const metadata = { title: "Otel otaq hesabları", robots: { index: false, follow: false } };
export default function HotelRoomBilling() {
 return <Suspense fallback={<main className="p-8">Otaq hesabları yüklənir...</main>}><BillingContent/></Suspense>;
}
async function BillingContent() {
 if(!hotelModuleEnabled())notFound();
 const manager=await getHotelSession();
 if(!manager)redirect("/hotel-admin");
 const hotel=await db.hotel.findUnique({
  where:{id:manager.hotelId},select:{name:true}
 });
 if(!hotel)notFound();
 const [charges,totals]=await Promise.all([
  db.hotelRoomCharge.findMany({
   where:{hotelId:manager.hotelId},
   orderBy:[{createdAt:"desc"},{id:"desc"}],
   take:100,
   include:{
    room:{select:{number:true}},
    order:{select:{status:true,department:true}},
    events:{orderBy:{createdAt:"asc"},select:{id:true,toStatus:true,createdAt:true}},
   },
  }),
  db.hotelRoomCharge.groupBy({
   by:["status"],where:{hotelId:manager.hotelId},
   _count:{_all:true},_sum:{amount:true},
  }),
 ]);
 const amount=(status:"PENDING"|"APPROVED"|"VOID")=>totals
  .filter(t=>t.status===status).reduce((sum,t)=>sum.add(t._sum.amount??new Prisma.Decimal(0)),new Prisma.Decimal(0)).toFixed(2);
 return <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
  <div className="mx-auto max-w-5xl space-y-5">
   <header className="rounded-xl bg-white p-5">
    <Link href="/hotel-admin" className="text-sm text-blue-700 underline">← Otel admin</Link>
    <h1 className="mt-2 text-2xl font-bold">{hotel.name} · Otaq hesabları</h1>
    <p className="mt-2 text-sm text-amber-900">Bu daxili qeydiyyatdır: bank ödənişi, pulun alınması və PMS sisteminə göndəriş həyata keçirilmir.</p>
   </header>
   <div className="grid gap-3 sm:grid-cols-3">
    <p className="rounded-xl bg-white p-5">Gözləyən: <strong>{amount("PENDING")} ₼</strong></p>
    <p className="rounded-xl bg-white p-5">Daxili təsdiq: <strong>{amount("APPROVED")} ₼</strong></p>
    <p className="rounded-xl bg-white p-5">Ləğv: <strong>{amount("VOID")} ₼</strong></p>
   </div>
   <p className="text-xs text-zinc-600">Son 100 qeyd göstərilir; yekun məbləğlər bu otelin bütün qeydlərindən hesablanır.</p>
   {charges.map(charge=><article key={charge.id} data-charge-id={charge.id} className="space-y-3 rounded-xl bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <h2 className="font-bold">Otaq № {charge.room.number} · {charge.amount.toFixed(2)} ₼</h2>
     <span className="text-sm font-semibold">{charge.status==="APPROVED"?"Daxili təsdiq":charge.status==="VOID"?"Ləğv edildi":"Təsdiq gözləyir"}</span>
    </div>
    <p className="text-sm text-zinc-600">Sifariş: {charge.order.status} · {charge.order.department} · {charge.createdAt.toLocaleString("az-AZ",{timeZone:"Asia/Baku"})}</p>
    {canApproveHotelRoomCharge(charge.order.status,charge.status)&&<form action={decideHotelRoomCharge}>
      <input type="hidden" name="chargeId" value={charge.id}/><input type="hidden" name="decision" value="APPROVED"/>
      <button className="rounded-lg bg-emerald-800 px-4 py-2 font-medium text-white">Otaq hesabını təsdiqlə</button>
    </form>}
    {canVoidHotelRoomCharge(charge.status)&&<form action={decideHotelRoomCharge}>
      <input type="hidden" name="chargeId" value={charge.id}/><input type="hidden" name="decision" value="VOID"/>
      <button className="rounded-lg border px-4 py-2 text-sm">Gözləyən qeydi ləğv et</button>
    </form>}
    <details><summary className="cursor-pointer text-xs">Audit tarixçəsi</summary>
     <ul className="mt-2 text-xs text-zinc-600">{charge.events.map(e=><li key={e.id}>{e.toStatus} · {e.createdAt.toLocaleString("az-AZ",{timeZone:"Asia/Baku"})}</li>)}</ul>
    </details>
   </article>)}
   {charges.length===0&&<p className="rounded-xl bg-white p-5">Hələ otaq hesabı qeydi yoxdur.</p>}
  </div>
 </main>;
}
