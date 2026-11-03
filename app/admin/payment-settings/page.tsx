import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/app/lib/db";
import { getAdminSession } from "@/app/lib/admin-auth";
import { saveOwnerPaymentSettings } from "./actions";

export const metadata = {
  title: "VÖEN və ödəniş məlumatları | QR Menü",
  robots: { index: false, follow: false },
};

const APPROVAL_LABELS = {
  NOT_SUBMITTED: "Müraciət edilməyib",
  PENDING: "Provayder yoxlayır",
  APPROVED: "Təsdiqlənib (müqavilə ayrıca yoxlanmalıdır)",
  REJECTED: "Rədd edilib",
} as const;

type Props = {
  searchParams: Promise<{ saved?: string | string[]; error?: string | string[] }>;
};

export default function RestaurantAdminPaymentSettingsPage(props: Props) {
  return (
    <Suspense fallback={<main className="p-8">Yüklənir...</main>}>
      <RestaurantAdminPaymentSettingsContent {...props} />
    </Suspense>
  );
}

async function RestaurantAdminPaymentSettingsContent({ searchParams }: Props) {
  // Hüquqi məlumatları yalnız serverdə yoxlanılmış restoran sessiyası oxuyur.
  const session = await getAdminSession();
  if (!session) {
    return (
      <main className="p-8 text-zinc-900">
        <h1 className="text-xl font-bold">Giriş tələb olunur</h1>
        <Link href="/admin" className="text-blue-700 underline">Admin giriş səhifəsinə keç</Link>
      </main>
    );
  }

  // Restaurant identifikatoru URL və ya inputdan deyil, imzalanmış sessiyadan gəlir.
  const restaurant = await db.restaurant.findUnique({
    where: { id: session.restaurantId },
    select: {
      name: true,
      slug: true,
      paymentSettings: {
        select: {
          legalName: true,
          taxId: true,
          paymentMode: true,
          providerName: true,
          providerMerchantId: true,
          approvalStatus: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!restaurant) return <main className="p-8 text-zinc-900">Restoran tapılmadı.</main>;

  const query = await searchParams;
  const settings = restaurant.paymentSettings;
  const input = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-zinc-900";

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-zinc-900 md:p-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <Link href={"/admin?slug=" + encodeURIComponent(restaurant.slug)}
            className="text-sm font-medium text-blue-700 underline">
            ← İdarəetmə panelinə qayıt
          </Link>
          <h1 className="mt-3 text-2xl font-bold">VÖEN və ödəniş məlumatları</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {restaurant.name} — yalnız bu restorana aid məlumatlar dəyişdirilə bilər.
          </p>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Provayder təsdiqi</h2>
          <p className="mt-2 text-sm">
            Mövcud status: <strong>{APPROVAL_LABELS[settings?.approvalStatus ?? "NOT_SUBMITTED"]}</strong>
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            Təsdiq statusu bu səhifədən dəyişdirilə bilməz.
            Hüquqi məlumat, provayder və ya ödəniş rejimi dəyişdikdə əvvəlki
            təsdiq statusu sıfırlanır və yenidən yoxlama tələb olunur.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Hüquqi və ödəniş məlumatlarını düzəlt</h2>

          {query.saved === "1" && (
            <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
              Məlumatlar uğurla yadda saxlanıldı.
            </p>
          )}
          {query.error === "validation" && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-900">
              Məlumatları yoxlayın: VÖEN daxil edilirsə 10 rəqəm olmalı,
              provayderin adı və merchant ID-si hər ikisi doldurulmalı və ya boş qalmalıdır.
            </p>
          )}
          {query.error === "stale" && (
            <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
              Məlumatlar başqa sessiyada dəyişdirilib. Səhifəni yeniləyərək yenidən yoxlayın.
            </p>
          )}

          <form action={saveOwnerPaymentSettings} className="space-y-4">
            <input type="hidden" name="version" value={settings?.updatedAt.toISOString() ?? "new"} />
            <label className="block text-sm font-medium">
              Hüquqi şəxs / sahibkarın adı
              <input name="legalName" type="text" maxLength={200}
                defaultValue={settings?.legalName ?? ""} autoComplete="organization"
                placeholder="Rəsmi qeydiyyat adı" className={input} />
            </label>

            <label className="block text-sm font-medium">
              VÖEN (10 rəqəm)
              <input name="taxId" type="text" inputMode="numeric"
                pattern="[0-9]{10}" maxLength={10}
                defaultValue={settings?.taxId ?? ""}
                placeholder="VÖEN yoxdursa boş saxlayın" className={input} />
            </label>

            <label className="block text-sm font-medium">
              Planlaşdırılan ödəniş üsulları
              <select name="paymentMode"
                defaultValue={settings?.paymentMode ?? "CASH_ONLY"} className={input}>
                <option value="CASH_ONLY">Yalnız nağd</option>
                <option value="CASH_AND_CARD">Nağd + kart (yalnız planlaşdırma)</option>
              </select>
            </label>

            <label className="block text-sm font-medium">
              Ödəniş provayderinin adı
              <input name="providerName" type="text" maxLength={100}
                defaultValue={settings?.providerName ?? ""}
                placeholder="Məsələn: bank və ya provayder" className={input} />
            </label>

            <label className="block text-sm font-medium">
              Provayder merchant ID (gizli açar deyil)
              <input name="providerMerchantId" type="text" maxLength={150}
                defaultValue={settings?.providerMerchantId ?? ""}
                autoComplete="off"
                placeholder="Provayderin verdiyi merchant identifikatoru" className={input} />
            </label>

            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
              Bank kartı nömrəsi, CVV, şifrə və API açarlarını bu formaya daxil etməyin.
              Kart ödənişi hələ aktiv deyil: bank müqaviləsi, server inteqrasiyası
              və təhlükəsiz ödəniş təsdiqi ayrıca tələb olunur.
            </p>

            <button type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-semibold text-white hover:bg-zinc-800">
              Ödəniş məlumatlarını yadda saxla
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
