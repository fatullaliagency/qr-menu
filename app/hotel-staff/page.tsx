import { Suspense } from "react";
import { hotelModuleEnabled } from "@/app/lib/hotel-validation";
import { loginHotelStaff } from "./actions";
export const metadata = { title: "Otel əməkdaş girişi", robots: { index: false, follow: false } };
export default function HotelStaffLogin(p: { searchParams: Promise<{ error?: string | string[] }> }) {
  return <Suspense fallback={<main className="p-8">Yüklənir...</main>}><Content {...p}/></Suspense>;
}
async function Content({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  if (!hotelModuleEnabled()) return <main className="p-8">Otel modulu test mühitində aktiv deyil.</main>;
  const query = await searchParams;
  const input = "mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3";
  return <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-5 text-zinc-900">
    <form action={loginHotelStaff} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6">
      <h1 className="text-2xl font-bold">Otel əməkdaş girişi</h1>
      <p className="text-sm text-zinc-600">Yalnız sizin xidmət şöbənizin sifarişləri açılacaq.</p>
      {query.error && <p role="alert" className="text-sm text-red-700">Giriş alınmadı. Məlumatları yoxlayın; təkrar uğursuz girişlər müvəqqəti bloklanır.</p>}
      <label className="block text-sm font-medium">Otelin URL adı<input className={input} name="slug" required maxLength={60}/></label>
      <label className="block text-sm font-medium">Əməkdaş istifadəçi adı<input className={input} name="username" required autoComplete="username" maxLength={40}/></label>
      <label className="block text-sm font-medium">Əməkdaş PİN-i<input className={input} name="pin" type="password" inputMode="numeric" required minLength={6} maxLength={12} autoComplete="current-password"/></label>
      <button className="w-full rounded-lg bg-emerald-800 p-3 font-semibold text-white">Daxil ol</button>
    </form>
  </main>;
}
