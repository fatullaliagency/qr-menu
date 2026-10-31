import { createHash, timingSafeEqual } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { hashRestaurantPin } from "@/app/lib/pin-security";

type PageProps = {
  searchParams: Promise<{ created?: string; error?: string }>;
};

const RESERVED_SLUGS = new Set([
  "admin", "api", "_next", "login", "robots.txt", "sitemap.xml", "favicon.ico",
]);

function field(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function secretMatches(entered: string, expected: string): boolean {
  const enteredHash = createHash("sha256").update(entered, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(enteredHash, expectedHash);
}

async function createRestaurant(fd: FormData) {
  "use server";

  const configuredSecret = process.env.ADMIN_CREATION_SECRET;
  // Missing/weak configuration disables restaurant creation.
  if (!configuredSecret || Buffer.byteLength(configuredSecret, "utf8") < 32) {
    redirect("/admin/restaurants/new?error=configuration");
  }

  const ownerSecret = field(fd, "ownerSecret");
  if (!secretMatches(ownerSecret, configuredSecret)) {
    redirect("/admin/restaurants/new?error=authorization");
  }

  const name = field(fd, "name");
  const slug = field(fd, "slug").toLowerCase();
  const phone = field(fd, "phone");
  const pin = field(fd, "pin");

  if (
    name.length < 2 || name.length > 120 ||
    phone.length < 3 || phone.length > 100 ||
    !/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) ||
    RESERVED_SLUGS.has(slug) ||
    !/^\d{4,12}$/.test(pin)
  ) {
    redirect("/admin/restaurants/new?error=validation");
  }

  const pinHash = await hashRestaurantPin(pin);

  // Do not edit any existing restaurant. A duplicate slug is rejected.
  try {
    await db.restaurant.create({
      data: { name, slug, phone, pinCode: pinHash },
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" && error !== null &&
      "code" in error && error.code === "P2002"
    ) {
      redirect("/admin/restaurants/new?error=duplicate");
    }
    throw error;
  }

  redirect(`/admin/restaurants/new?created=${encodeURIComponent(slug)}`);
}

const errors: Record<string, string> = {
  configuration: "ADMIN_CREATION_SECRET Vercel-də qurulmayıb və ya 32 simvoldan qısadır.",
  authorization: "Sahibin gizli açarı yanlışdır.",
  validation: "Məlumatları yoxlayın: ad 2–120, telefon 3–100 simvol, URL adı 3–40 kiçik latın hərfi/rəqəm/tire, PİN isə 4–12 rəqəm olmalıdır.",
  duplicate: "Bu URL adı artıq istifadə olunur. Başqa ad seçin.",
};

export default async function NewRestaurantPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const created = typeof params.created === "string" &&
    /^[a-z0-9-]{3,40}$/.test(params.created) ? params.created : null;
  const error = typeof params.error === "string" ? errors[params.error] : null;

  const input = "w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-gray-900";

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-md">
        <h1 className="mb-2 text-2xl font-bold">Yeni restoran yarat</h1>
        <p className="mb-6 text-sm text-gray-600">
          Bu səhifə yalnız sistem sahibinin gizli açarı ilə restoran yaradır.
        </p>

        {created && (
          <div className="mb-5 rounded-xl border border-green-300 bg-green-50 p-4">
            <p className="font-semibold">Restoran yaradıldı!</p>
            <div className="mt-2 flex flex-col gap-2 text-sm underline">
              <Link href={`/${created}`}>Müştəri menyusunu aç</Link>
              <Link href={`/admin?slug=${created}`}>Bu restoranın admin girişini aç</Link>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mb-5 rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
            {error}
          </p>
        )}

        <form action={createRestaurant} className="space-y-4">
          <label className="block text-sm font-semibold">
            Restoranın adı
            <input name="name" required minLength={2} maxLength={120}
              placeholder="Məsələn: Yeni Kafe" className={`mt-1 ${input}`} />
          </label>
          <label className="block text-sm font-semibold">
            URL adı (slug)
            <input name="slug" required minLength={3} maxLength={40}
              placeholder="meselen-yeni-kafe" pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
              className={`mt-1 ${input}`} />
            <span className="mt-1 block text-xs font-normal text-gray-500">
              Kiçik latın hərfləri, rəqəmlər və tire. Boşluq olmaz.
            </span>
          </label>
          <label className="block text-sm font-semibold">
            Telefon
            <input name="phone" type="tel" required maxLength={100}
              placeholder="+994..." className={`mt-1 ${input}`} />
          </label>
          <label className="block text-sm font-semibold">
            Restoran PİN kodu
            <input name="pin" type="password" inputMode="numeric" required
              minLength={4} maxLength={12} pattern="[0-9]{4,12}"
              autoComplete="new-password" className={`mt-1 ${input}`} />
          </label>
          <label className="block text-sm font-semibold">
            Sahibin gizli açarı (ADMIN_CREATION_SECRET)
            <input name="ownerSecret" type="password" required
              autoComplete="off" className={`mt-1 ${input}`} />
          </label>
          <button type="submit"
            className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800">
            Restoran yarat
          </button>
        </form>
        <p className="mt-5 text-xs text-gray-500">
          Gizli açarı GitHub-a, ekran şəklinə və ya ictimai yerə yazmayın.
          Restoranların PİN kodları scrypt ilə şifrələnmiş saxlanılır.
        </p>
      </div>
    </main>
  );
}
