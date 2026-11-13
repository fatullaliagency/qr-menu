import {Suspense} from "react";
import Link from "next/link";
import {getHotelSession,getHotelSecret} from "@/app/lib/hotel-auth";
import {hotelModuleEnabled,hotelCategoryLabels,hotelDepartmentLabels} from "@/app/lib/hotel-validation";
import {hotelRoomToken} from "@/app/lib/hotel-security";
import {db} from "@/app/lib/db";
import {loginHotel,logoutHotel,addHotelRoom,setHotelRoomStatus,addHotelService,toggleHotelService,setHotelDepartments,createHotelStaff,setHotelStaffActive,resetHotelStaffPin} from "./actions";
import RoomQRCode from "./RoomQRCode";
export const metadata={title:"Otel admin paneli",robots:{index:false,follow:false}};
type Props={searchParams:Promise<{error?:string|string[]}>};
export default function HotelAdminPage(p:Props){
 return <Suspense fallback={<main className="p-8">Yüklənir...</main>}><Panel {...p}/></Suspense>;
}
async function Panel({searchParams}:Props){
 if(!hotelModuleEnabled())return <main className="p-8">Otel modulu test mühitində aktivləşdirilməyib.</main>;
 const session=await getHotelSession();
 const input="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-zinc-900";
 if(!session){
  const query=await searchParams;const error=typeof query.error==="string"?query.error:"";
  return <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-5 text-white">
   <form action={loginHotel} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-zinc-900">
     <h1 className="text-2xl font-bold">Otel idarəetməsi</h1>
     {error&&<p role="alert" className="text-sm text-rose-700">Giriş alınmadı. Otel URL adı və PİN kodunu yoxlayın. Təkrar yanlış cəhdlər 15 dəqiqəlik bloklanır.</p>}
     <label className="block text-sm font-medium">Otelin URL adı<input name="slug" required className={input}/></label>
     <label className="block text-sm font-medium">Otel PİN-i<input type="password" name="pin" required minLength={6} maxLength={12} className={input}/></label>
     <button type="submit" className="w-full rounded-lg bg-emerald-800 p-3 font-semibold text-white">Daxil ol</button>
   </form>
  </main>;
 }
 const hotel=await db.hotel.findUnique({
  where:{id:session.hotelId},
  include:{rooms:{orderBy:{number:"asc"}},services:{orderBy:{createdAt:"desc"}},staff:{orderBy:{createdAt:"desc"}}},
 });
 if(!hotel)return <main className="p-8">Otel tapılmadı.</main>;
 const counts=await db.hotelOrder.groupBy({
  by:["department"],where:{hotelId:hotel.id,status:{not:"COMPLETED"}},_count:{_all:true},
 });
 const deptCounts=Object.fromEntries(counts.map(x=>[x.department,x._count._all]));
 return <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
  <div className="mx-auto max-w-6xl space-y-6">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-5">
    <div><p className="text-sm font-semibold text-emerald-800">Otel admin paneli</p>
      <h1 className="text-2xl font-bold">{hotel.name}</h1>
      <p className="text-sm text-zinc-500">{hotel.branchName??""} · Otaq sayı: {hotel.roomCount}</p>
    </div>
    <form action={logoutHotel}><button className="rounded-lg bg-zinc-900 px-4 py-2 text-white">Çıxış</button></form>
   </header>
   <nav className="grid gap-3 sm:grid-cols-3">
    {(["KITCHEN","HOUSEKEEPING","RECEPTION"] as const).map(d=><Link key={d}
      href={"/hotel-admin/panel/"+d.toLowerCase()}
      className="rounded-xl bg-emerald-950 p-5 font-bold text-white">
      {hotelDepartmentLabels[d]}<span className="mt-2 block text-sm font-normal">Aktiv müraciətlər: {deptCounts[d]??0}</span>
    </Link>)}
   </nav>

   <p className="rounded-xl bg-white p-5"><Link className="font-semibold text-blue-700 underline" href="/hotel-admin/billing">Otaq hesabları və daxili təsdiqlər →</Link></p>
   <section className="space-y-4 rounded-xl bg-white p-5">
    <h2 className="text-xl font-bold">Əməkdaş hesabları və şöbə icazələri</h2>
    <p className="text-sm text-zinc-600">Hər əməkdaş öz istifadəçi adı və PİN-i ilə /hotel-staff səhifəsindən daxil olur. Ümumi menecer PİN-ini paylaşmayın.</p>
    <form action={createHotelStaff} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium">Əməkdaş adı<input name="name" required minLength={2} maxLength={120} className={input}/></label>
      <label className="text-sm font-medium">İstifadəçi adı<input name="username" required minLength={3} maxLength={40} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,39}" className={input}/></label>
      <label className="text-sm font-medium">Şöbə<select name="department" className={input}>
       {(["KITCHEN","HOUSEKEEPING","RECEPTION"] as const).map(d=><option key={d} value={d}>{hotelDepartmentLabels[d]}</option>)}
      </select></label>
      <label className="text-sm font-medium">İlkin PİN<input name="pin" type="password" inputMode="numeric" required minLength={6} maxLength={12} pattern="[0-9]{6,12}" autoComplete="new-password" className={input}/></label>
      <button className="rounded-lg bg-emerald-800 px-4 py-3 font-bold text-white sm:col-span-2">Əməkdaş yarat</button>
    </form>
    {hotel.staff.map(member=><article key={member.id} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
      <div><p className="font-semibold">{member.name} · {member.username}</p>
       <p className="text-xs text-zinc-600">{hotelDepartmentLabels[member.department]} · {member.active?"Aktiv":"Deaktiv"}</p>
      </div>
      <form action={setHotelStaffActive} className="flex items-end gap-2">
       <input type="hidden" name="id" value={member.id}/>
       <input type="hidden" name="active" value={String(!member.active)}/>
       <button className="rounded-lg border px-3 py-2 text-sm">{member.active?"Girişi bağla":"Girişi aktiv et"}</button>
      </form>
      <form action={resetHotelStaffPin} className="flex items-end gap-2 sm:col-span-2">
       <input type="hidden" name="id" value={member.id}/>
       <label className="flex-1 text-sm">Yeni PİN<input name="pin" type="password" required inputMode="numeric" minLength={6} maxLength={12} pattern="[0-9]{6,12}" autoComplete="new-password" className={input}/></label>
       <button className="rounded-lg border px-3 py-2 text-sm">PİN-i yenilə</button>
      </form>
    </article>)}
   </section>
   <section className="space-y-3 rounded-xl bg-white p-5">
    <h2 className="text-xl font-bold">Aktiv xidmət bölmələri</h2>
    <form action={setHotelDepartments} className="flex flex-wrap items-center gap-4">
     <label><input name="foodEnabled" type="checkbox" defaultChecked={hotel.foodEnabled}/> Yemək-içki</label>
     <label><input name="roomServiceEnabled" type="checkbox" defaultChecked={hotel.roomServiceEnabled}/> Otaq xidməti</label>
     <label><input name="extraEnabled" type="checkbox" defaultChecked={hotel.extraEnabled}/> Əlavə xidmətlər</label>
     <button className="rounded-lg bg-zinc-900 px-4 py-2 text-white">Yadda saxla</button>
    </form>
   </section>
   <section className="space-y-4 rounded-xl bg-white p-5">
    <h2 className="text-xl font-bold">Otaqlar və QR kodları</h2>
    <p className="text-sm text-amber-900">Otaq yalnız “Dolu” olduqda qonaq sifariş verə bilər. “Boş” statusuna keçid əvvəlki QR tokenini ləğv edir: yeni QR-ni çap edin.</p>
    <form action={addHotelRoom} className="flex flex-wrap items-end gap-2">
     <label className="text-sm font-medium">Yeni otaq nömrəsi<input name="number" required pattern="[a-zA-Z0-9-]{1,20}" maxLength={20}
      placeholder="Məsələn: 101" className={input}/></label>
     <button type="submit" className="rounded-lg bg-emerald-800 px-4 py-2.5 font-semibold text-white">Otaq əlavə et</button>
    </form>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
     {hotel.rooms.map(room=><article key={room.id} className="space-y-3 rounded-xl border border-zinc-200 p-4">
       <h3 className="text-lg font-bold">Otaq № {room.number}</h3>
       <form action={setHotelRoomStatus} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="roomId" value={room.id}/>
        <label className="text-sm">Status
         <select name="status" defaultValue={room.status} className={input}>
          <option value="VACANT">Boş</option><option value="OCCUPIED">Dolu</option><option value="OUT_OF_SERVICE">Xidmətdən kənar</option>
         </select>
        </label>
        <button type="submit" className="rounded-lg bg-zinc-800 px-3 py-2.5 text-sm text-white">Yadda saxla</button>
       </form>
       <RoomQRCode slug={hotel.slug} number={room.number}
         token={hotelRoomToken(getHotelSecret(),hotel.id,room.id,room.qrNonce)}/>
     </article>)}
    </div>
   </section>
   <section className="space-y-4 rounded-xl bg-white p-5">
    <h2 className="text-xl font-bold">Xidmət kataloqu</h2>
    <form action={addHotelService} className="grid gap-3 sm:grid-cols-2">
     <label className="text-sm font-medium">Xidmət adı<input name="name" required minLength={2} maxLength={120} placeholder="Dəsmal gətirilməsi" className={input}/></label>
     <label className="text-sm font-medium">Bölmə<select name="category" className={input}>
      {(["FOOD","ROOM_SERVICE","EXTRA"] as const).map(cat=><option key={cat} value={cat}>{hotelCategoryLabels[cat]}</option>)}
     </select></label>
     <label className="text-sm font-medium">Qiymət (AZN)<input name="price" type="number" min={0} max={999999} step="0.01" defaultValue="0" required className={input}/></label>
     <label className="text-sm font-medium">İzah<input name="description" maxLength={500} className={input}/></label>
     <button className="rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white sm:col-span-2">Xidmət yarat</button>
    </form>
    <div className="space-y-2">
     {hotel.services.map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-3">
      <div><p className="font-semibold">{s.name} · {s.price.toString()} ₼</p>
        <p className="text-xs text-zinc-500">{hotelCategoryLabels[s.category]} · {s.active?"Aktiv":"Deaktiv"}</p></div>
      <form action={toggleHotelService}>
       <input type="hidden" name="id" value={s.id}/><input type="hidden" name="active" value={String(!s.active)}/>
       <button className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">{s.active?"Deaktiv et":"Aktiv et"}</button>
      </form>
     </div>)}
    </div>
   </section>
  </div>
 </main>;
}
