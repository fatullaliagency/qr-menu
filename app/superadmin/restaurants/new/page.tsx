import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasSuperAdminSession } from "@/app/lib/superadmin-auth";
import { createSuperAdminRestaurant } from "./actions";
import RestaurantNameInput from "@/app/admin/restaurants/new/RestaurantNameInput";

export const metadata = {
  title: "Yeni restoran yarat | QR Menü Super Admin",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{
    created?: string | string[];
    error?: string | string[];
  }>;
};

const ERRORS: Record<string, string> = {
  validation:
    "Məlumatları yoxlayın: restoran adı 2–120, telefon 6–30 simvol, PİN 6–12 rəqəm, VÖEN daxil edilirsə 10 rəqəm olmalıdır.",
};

export default function NewSuperAdminRestaurantPage(props: Props) {
  return (
    <Suspense fallback={<main className="p-8">Yüklənir...</main>}>
      <NewRestaurantContent {...props} />
    </Suspense>
  );
}

async function NewRestaurantContent({ searchParams }: Props) {
  if (!(await hasSuperAdminSession())) redirect("/superadmin");

  const query = await searchParams;
  const created =
    typeof query.created === "string" && /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(query.created)
      ? query.created
      : null;
  const error = typeof query.error === "string" ? ERRORS[query.error] : null;
  const input = "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900";

  return (
    <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-xl bg-white p-5 shadow-sm">
          <Link href="/superadmin" className="text-sm font-medium text-blue-700 underline">
            ← Super Admin icmalına qayıt
          </Link>
          <h1 className="mt-3 text-2xl font-bold">Yeni restoran yarat</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Test mühitində yeni restoran və fərdi idarəetmə PİN-i yaradın.
            İlkin ödəniş rejimi yalnız nağddır.
          </p>
        </header>

        {created && (
          <section role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="font-bold text-emerald-900">Restoran yaradıldı!</h2>
            <p className="mt-2 text-sm text-emerald-950">
              URL adı: <strong>{created}</strong>. İdarəetmə PİN-i scrypt ilə şifrələnmiş saxlanılır.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-blue-700 underline">
              <Link href={"/" + created}>Müştəri menyusunu aç</Link>
              <Link href={"/admin?slug=" + created}>Restoran admin girişinə keç</Link>
              <Link href={"/superadmin/restaurants/" + created + "/payment-settings"}>
                VÖEN və ödəniş ayarları
              </Link>
            </div>
          </section>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {error}
          </p>
        )}

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <form action={createSuperAdminRestaurant} className="space-y-4">
            <RestaurantNameInput className={input}
              labelClassName="block text-sm font-medium" placeholder="Məsələn: Qoşa Samovar" />
            <label className="block text-sm font-medium">
              Restoran telefonu
              <input name="phone" type="tel" required minLength={6} maxLength={30}
                placeholder="+994..." className={input} />
            </label>
            <label className="block text-sm font-medium">
              Fərdi idarəetmə PİN-i (6–12 rəqəm)
              <input name="pin" type="password" required minLength={6} maxLength={12}
                pattern="[0-9]{6,12}" inputMode="numeric"
                autoComplete="new-password" className={input} />
              <span className="mt-1 block text-xs text-zinc-500">
                Asan təxmin edilən PİN seçməyin. PİN-i bizə göndərməyin.
              </span>
            </label>
            <label className="block text-sm font-medium">
              Hüquqi ad (istəyə bağlı)
              <input name="legalName" maxLength={200}
                placeholder="Məsələn: Test Kafe MMC" className={input} />
            </label>
            <label className="block text-sm font-medium">
              VÖEN (istəyə bağlı, 10 rəqəm)
              <input name="taxId" inputMode="numeric" pattern="[0-9]{10}"
                maxLength={10} placeholder="Test zamanı boş saxlayın" className={input} />
            </label>
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
              Real kart ödənişi aktiv deyil. Bank kartı, API açarı və ya
              məxfi provayder məlumatlarını bu formaya daxil etməyin.
            </p>
            <button type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-semibold text-white hover:bg-zinc-800">
              Restoran yarat
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
