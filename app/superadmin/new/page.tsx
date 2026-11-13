import Link from "next/link";
import {Suspense} from "react";
import {redirect} from "next/navigation";
import {hasSuperAdminSession} from "@/app/lib/superadmin-auth";
import {hotelModuleEnabled} from "@/app/lib/hotel-validation";
export const metadata={title:"Yeni müəssisə",robots:{index:false,follow:false}};
export default function NewEnterprisePage(){
 return <Suspense fallback={<main className="p-8">Yüklənir...</main>}><NewEnterpriseContent/></Suspense>;
}
async function NewEnterpriseContent(){
 if(!(await hasSuperAdminSession()))redirect("/superadmin");
 return <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
  <div className="mx-auto max-w-xl space-y-5 rounded-xl bg-white p-6">
   <h1 className="text-2xl font-bold">Yeni müəssisə yaradın</h1>
   <p>Hansı müəssisə növünü əlavə etmək istəyirsiniz?</p>
   <Link href="/superadmin/restaurants/new" className="block rounded-xl bg-zinc-900 p-5 font-bold text-white">Restoran əlavə et</Link>
   {hotelModuleEnabled()&&<Link href="/superadmin/hotels/new" className="block rounded-xl bg-emerald-800 p-5 font-bold text-white">Otel əlavə et</Link>}
   <Link href="/superadmin" className="text-sm text-blue-700 underline">Geri qayıt</Link>
  </div>
 </main>;
}
