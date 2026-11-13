import Link from "next/link";
import {Suspense} from "react";
import {redirect} from "next/navigation";
import {hasSuperAdminSession} from "@/app/lib/superadmin-auth";
import {hotelModuleEnabled} from "@/app/lib/hotel-validation";
import {createSuperAdminHotel} from "./actions";
export const metadata={title:"Yeni otel yarat",robots:{index:false,follow:false}};
type Props={searchParams:Promise<{created?:string|string[];error?:string|string[]}>};
export default function NewHotelPage(p:Props){
 return <Suspense fallback={<main className="p-8">Yüklənir...</main>}><Content {...p}/></Suspense>;
}
async function Content({searchParams}:Props){
 if(!hotelModuleEnabled()||!(await hasSuperAdminSession()))redirect("/superadmin");
 const q=await searchParams;
 const created=typeof q.created==="string"&&/^[a-z0-9-]{3,60}$/.test(q.created)?q.created:null;
 const input="mt-1 block w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-zinc-900";
 return <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
  <div className="mx-auto max-w-2xl space-y-5">
   <header className="rounded-xl bg-white p-5">
    <Link href="/superadmin" className="text-sm text-blue-700 underline">← Superadmin</Link>
    <h1 className="mt-2 text-2xl font-bold">Yeni otel yarat</h1>
    <p className="text-sm text-zinc-500">Otel üçün ayrıca otaqlar, admin PİN-i və xidmət bölmələri yaradılacaq.</p>
   </header>
   {q.error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-900">Məlumatları yoxlayın: 1–500 otaq, 6–12 rəqəmli PİN və ən az bir bölmə seçilməlidir.</p>}
   {created&&<section className="rounded-xl bg-emerald-50 p-5 text-emerald-900">
      <h2 className="font-bold">Otel yaradıldı: {created}</h2>
      <p className="text-sm">Otaq QR-lərinə baxmaq üçün otelin admin panelinə daxil olun.</p>
      <Link href="/hotel-admin" className="mt-3 inline-block text-blue-700 underline">Otel admin girişi</Link>
   </section>}
   <form action={createSuperAdminHotel} className="space-y-4 rounded-xl bg-white p-5">
    <label className="block text-sm font-medium">Otelin adı<input name="name" required minLength={2} maxLength={120} className={input}/></label>
    <label className="block text-sm font-medium">Filialın adı<input name="branchName" maxLength={120} className={input}/></label>
    <label className="block text-sm font-medium">Otaq sayı (ilkin olaraq 1, 2, ... yaradılır)<input name="roomCount" type="number" min={1} max={500} defaultValue={10} required className={input}/></label>
    <label className="block text-sm font-medium">Əlaqə telefonu<input name="phone" type="tel" minLength={6} maxLength={30} required className={input}/></label>
    <label className="block text-sm font-medium">E-poçt<input name="email" type="email" maxLength={200} className={input}/></label>
    <label className="block text-sm font-medium">Ünvan<input name="address" maxLength={300} className={input}/></label>
    <label className="block text-sm font-medium">Otel idarəetmə PİN-i<input name="pin" type="password" required minLength={6} maxLength={12} pattern="[0-9]{6,12}"
      autoComplete="new-password" className={input}/></label>
    <fieldset className="space-y-2 rounded-lg border border-zinc-200 p-4">
      <legend className="font-semibold">Xidmət bölmələri</legend>
      <label className="block"><input type="checkbox" name="foodEnabled" defaultChecked/> Yemək-içki / restoran</label>
      <label className="block"><input type="checkbox" name="roomServiceEnabled" defaultChecked/> Dəsmal, təmizlik, gigiyena</label>
      <label className="block"><input type="checkbox" name="extraEnabled" defaultChecked/> Transfer, SPA, əlavə xidmətlər</label>
    </fieldset>
    <p className="text-xs text-zinc-500">İlkin ödəniş yalnız otelin təsdiqinə göndərilən otaq hesabı qeydidir. Avtomatik bank ödənişi edilmir.</p>
    <button className="w-full rounded-xl bg-emerald-800 p-3 font-bold text-white">Otel yarat</button>
   </form>
  </div>
 </main>;
}
