import { Suspense } from "react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { getAdminSession, requireAdminSession } from "@/app/lib/admin-auth";
import AdminPinGuard from "./AdminPinGuard";
import ImagePickerInput from "./ImagePickerInput";
import QrCodeBox from "./QrCodeBox";

type PageProps = {
  searchParams: Promise<{ slug?: string | string[] }>;
};

function readText(fd: FormData, key: string, maxLength = 2000): string {
  const value = fd.get(key);
  if (typeof value !== "string") {
    throw new Error(`Yanlış forma sahəsi: ${key}`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new Error(`Məlumat çox uzundur: ${key}`);
  }
  return text;
}

function readRequired(fd: FormData, key: string, maxLength = 200): string {
  const text = readText(fd, key, maxLength);
  if (!text) throw new Error(`Məcburi sahə boşdur: ${key}`);
  return text;
}

function readPrice(fd: FormData): number {
  const raw = readRequired(fd, "price", 30);
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error("Qiymət düzgün formatda deyil.");
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 999999.99) {
    throw new Error("Qiymət icazə verilən aralıqda deyil.");
  }
  return value;
}

function readImage(fd: FormData, key: string): string | null {
  const value = fd.get(key);
  if (typeof value !== "string") throw new Error("Şəkil məlumatı yanlışdır.");
  const image = value.trim();
  if (!image) return null;
  if (/^https?:\/\//i.test(image) && image.length <= 2048) return image;
  if (
    image.length <= 700000 &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(image)
  ) {
    return image;
  }
  throw new Error("Şəkil çox böyükdür və ya formatı dəstəklənmir.");
}

async function authorizedRestaurant(fd: FormData) {
  const restaurantId = readRequired(fd, "restaurantId", 150);
  await requireAdminSession(restaurantId);
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, slug: true },
  });
  if (!restaurant) throw new Error("Restoran tapılmadı.");
  return restaurant;
}

function refreshMenu(slug: string) {
  revalidatePath("/admin");
  revalidatePath(`/${slug}`);
}

async function saveRestaurant(fd: FormData) {
  "use server";
  const restaurant = await authorizedRestaurant(fd);
  await db.restaurant.update({
    where: { id: restaurant.id },
    data: {
      name: readRequired(fd, "name", 200),
      phone: readRequired(fd, "phone", 100),
      subtitle: readText(fd, "subtitle"),
      slogan: readText(fd, "slogan"),
      description: readText(fd, "description", 5000),
      logoUrl: readImage(fd, "logoUrl"),
      bgImageUrl: readImage(fd, "bgImageUrl"),
      heroFoodUrl: readImage(fd, "heroFoodUrl"),
      wifiName: readText(fd, "wifiName", 200),
      wifiPassword: readText(fd, "wifiPassword", 200),
      address: readText(fd, "address", 500),
      workingHours: readText(fd, "workingHours", 200),
    },
  });
  refreshMenu(restaurant.slug);
}

async function addCategory(fd: FormData) {
  "use server";
  const restaurant = await authorizedRestaurant(fd);
  await db.category.create({
    data: {
      name: readRequired(fd, "name"),
      restaurantId: restaurant.id,
    },
  });
  refreshMenu(restaurant.slug);
}

async function editCategory(fd: FormData) {
  "use server";
  const restaurant = await authorizedRestaurant(fd);
  const id = readRequired(fd, "id", 150);
  const name = readRequired(fd, "name");
  const result = await db.category.updateMany({
    where: { id, restaurantId: restaurant.id },
    data: { name },
  });
  if (result.count !== 1) throw new Error("Kateqoriya tapılmadı.");
  refreshMenu(restaurant.slug);
}

async function deleteCategory(fd: FormData) {
  "use server";
  const restaurant = await authorizedRestaurant(fd);
  const id = readRequired(fd, "id", 150);
  await db.$transaction(async (tx) => {
    const category = await tx.category.findFirst({
      where: { id, restaurantId: restaurant.id },
      select: { id: true },
    });
    if (!category) throw new Error("Kateqoriya tapılmadı.");
    await tx.menuItem.deleteMany({
      where: { categoryId: id, restaurantId: restaurant.id },
    });
    const result = await tx.category.deleteMany({
      where: { id, restaurantId: restaurant.id },
    });
    if (result.count !== 1) throw new Error("Kateqoriya silinmədi.");
  });
  refreshMenu(restaurant.slug);
}

async function addMenuItem(fd: FormData) {
  "use server";
  const restaurant = await authorizedRestaurant(fd);
  const categoryId = readRequired(fd, "categoryId", 150);
  const category = await db.category.findFirst({
    where: { id: categoryId, restaurantId: restaurant.id },
    select: { id: true },
  });
  if (!category) throw new Error("Kateqoriya bu restorana aid deyil.");
  const description = readText(fd, "description");
  await db.menuItem.create({
    data: {
      name: readRequired(fd, "name"),
      price: readPrice(fd),
      description: description || null,
      imageUrl: readImage(fd, "imageUrl"),
      categoryId,
      restaurantId: restaurant.id,
    },
  });
  refreshMenu(restaurant.slug);
}

async function editMenuItem(fd: FormData) {
  "use server";
  const restaurant = await authorizedRestaurant(fd);
  const id = readRequired(fd, "id", 150);
  const description = readText(fd, "description");
  const result = await db.menuItem.updateMany({
    where: { id, restaurantId: restaurant.id },
    data: {
      name: readRequired(fd, "name"),
      price: readPrice(fd),
      description: description || null,
      imageUrl: readImage(fd, "imageUrl"),
    },
  });
  if (result.count !== 1) throw new Error("Məhsul tapılmadı.");
  refreshMenu(restaurant.slug);
}

async function deleteMenuItem(fd: FormData) {
  "use server";
  const restaurant = await authorizedRestaurant(fd);
  const id = readRequired(fd, "id", 150);
  const result = await db.menuItem.deleteMany({
    where: { id, restaurantId: restaurant.id },
  });
  if (result.count !== 1) throw new Error("Məhsul tapılmadı.");
  refreshMenu(restaurant.slug);
}

export default function AdminPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<div className="p-10 text-center">İdarəetmə paneli yüklənir...</div>}>
      <AdminContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const slug =
    typeof params.slug === "string" && params.slug.trim()
      ? params.slug.trim()
      : "fatullali";

  const session = await getAdminSession();
  if (!session) {
    return <AdminPinGuard restaurantSlug={slug}>{null}</AdminPinGuard>;
  }

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      phone: true,
      subtitle: true,
      slogan: true,
      description: true,
      logoUrl: true,
      bgImageUrl: true,
      heroFoodUrl: true,
      wifiName: true,
      wifiPassword: true,
      address: true,
      workingHours: true,
      categories: {
        select: {
          id: true,
          name: true,
          menuItems: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  });

  if (!restaurant) {
    return <div className="p-10 text-center font-bold text-red-600">Restoran tapılmadı.</div>;
  }
  if (session.restaurantId !== restaurant.id) {
    return <AdminPinGuard restaurantSlug={slug}>{null}</AdminPinGuard>;
  }

  const inputClass =
    "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-zinc-900";

  const restaurantIdInput = (
    <input type="hidden" name="restaurantId" value={restaurant.id} />
  );

  return (
    <AdminPinGuard restaurantSlug={restaurant.slug} initialAuthenticated={true}>
      <main className="min-h-screen bg-gray-100 p-4 text-gray-800 md:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm">
            <div>
              <h1 className="text-xl font-bold text-zinc-900 md:text-2xl">
                {restaurant.name} — İdarəetmə Paneli
              </h1>
              <p className="mt-1 text-xs text-gray-500">Restoran və menyu idarəetməsi</p>
            </div>
            <Link
              href={`/${restaurant.slug}`}
              target="_blank"
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Menyuya Bax ↗
            </Link>
          </header>

          <QrCodeBox slug={restaurant.slug} restaurantName={restaurant.name} />

          <form action={saveRestaurant} className="space-y-4 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            {restaurantIdInput}
            <h2 className="text-lg font-bold">👑 Restoran məlumatları</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <ImagePickerInput name="logoUrl" label="Loqo" defaultValue={restaurant.logoUrl ?? ""} />
              <ImagePickerInput name="bgImageUrl" label="Arxa plan" defaultValue={restaurant.bgImageUrl ?? ""} />
              <ImagePickerInput name="heroFoodUrl" label="Vitrin şəkli" defaultValue={restaurant.heroFoodUrl ?? ""} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input name="name" defaultValue={restaurant.name} placeholder="Restoran adı" required className={inputClass} />
              <input name="subtitle" defaultValue={restaurant.subtitle ?? ""} placeholder="Alt başlıq" className={inputClass} />
              <input name="slogan" defaultValue={restaurant.slogan ?? ""} placeholder="Sloqan" className={inputClass} />
              <input name="description" defaultValue={restaurant.description ?? ""} placeholder="Açıqlama" className={inputClass} />
              <input name="wifiName" defaultValue={restaurant.wifiName ?? ""} placeholder="Wi-Fi adı" className={inputClass} />
              <input name="wifiPassword" defaultValue={restaurant.wifiPassword ?? ""} placeholder="Wi-Fi şifrəsi" className={inputClass} />
              <input name="phone" defaultValue={restaurant.phone} placeholder="Telefon / WhatsApp" required className={inputClass} />
              <input name="address" defaultValue={restaurant.address ?? ""} placeholder="Ünvan" className={inputClass} />
              <input name="workingHours" defaultValue={restaurant.workingHours ?? ""} placeholder="İş saatları" className={`${inputClass} md:col-span-2`} />
            </div>
            <button type="submit" className="w-full rounded-xl bg-amber-600 py-3 font-bold text-white hover:bg-amber-700">
              💾 Restoran məlumatlarını yadda saxla
            </button>
          </form>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <form action={addCategory} className="h-fit space-y-3 rounded-2xl bg-white p-6 shadow-sm">
              {restaurantIdInput}
              <h2 className="text-lg font-bold">➕ Yeni kateqoriya</h2>
              <input name="name" required placeholder="Kateqoriya adı" className={inputClass} />
              <button type="submit" className="w-full rounded-xl bg-emerald-600 py-2.5 font-bold text-white hover:bg-emerald-700">
                Kateqoriya yarat
              </button>
            </form>
            <form action={addMenuItem} className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
              {restaurantIdInput}
              <h2 className="text-lg font-bold">🍔 Yeni məhsul</h2>
              <select name="categoryId" required defaultValue="" className={inputClass}>
                <option value="">-- Kateqoriya seçin --</option>
                {restaurant.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <input name="name" required placeholder="Məhsulun adı" className={inputClass} />
              <input type="number" name="price" required min="0" max="999999.99" step="0.01" placeholder="Qiymət (₼)" className={inputClass} />
              <input name="description" placeholder="Tərkibi / açıqlama" className={inputClass} />
              <ImagePickerInput name="imageUrl" label="Məhsulun şəkli" />
              <button type="submit" className="w-full rounded-xl bg-zinc-900 py-2.5 font-bold text-white hover:bg-zinc-800">
                Məhsulu menyuya əlavə et
              </button>
            </form>
          </div>

          <section className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">📋 Mövcud menyu siyahısı</h2>
            {restaurant.categories.map((cat) => (
              <div key={cat.id} className="space-y-3 rounded-2xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <form action={editCategory} className="flex items-center gap-2">
                    {restaurantIdInput}
                    <input type="hidden" name="id" value={cat.id} />
                    <input name="name" defaultValue={cat.name} required className="min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-1 font-bold" />
                    <button type="submit" className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-bold text-white">Adı dəyiş</button>
                  </form>
                  <form action={deleteCategory}>
                    {restaurantIdInput}
                    <input type="hidden" name="id" value={cat.id} />
                    <button type="submit" className="text-xs font-bold text-red-600 hover:text-red-700">🗑️ Kateqoriyanı sil</button>
                  </form>
                </div>

                {cat.menuItems.map((item) => (
                  <div key={item.id} className="border-b py-3 last:border-b-0">
                    <input type="checkbox" id={`edit_${item.id}`} className="peer hidden" />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt={item.name} className="h-14 w-14 shrink-0 rounded-xl border object-cover" />
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-900">{item.name}</div>
                          {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-bold text-emerald-600">{item.price.toFixed(2)} ₼</span>
                        <label htmlFor={`edit_${item.id}`} className="cursor-pointer rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white">✏️ Düzənlə</label>
                        <form action={deleteMenuItem}>
                          {restaurantIdInput}
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100">🗑️ Sil</button>
                        </form>
                      </div>
                    </div>
                    <form action={editMenuItem} className="mt-3 hidden space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4 peer-checked:block">
                      {restaurantIdInput}
                      <input type="hidden" name="id" value={item.id} />
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        <input name="name" defaultValue={item.name} required placeholder="Məhsulun adı" className={inputClass} />
                        <input type="number" name="price" defaultValue={item.price} required min="0" max="999999.99" step="0.01" placeholder="Qiymət" className={inputClass} />
                        <input name="description" defaultValue={item.description ?? ""} placeholder="Tərkibi" className={inputClass} />
                      </div>
                      <ImagePickerInput name="imageUrl" label="Yeni şəkil seç" defaultValue={item.imageUrl ?? ""} />
                      <button type="submit" className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700">💾 Yadda saxla</button>
                    </form>
                  </div>
                ))}
              </div>
            ))}
          </section>
        </div>
      </main>
    </AdminPinGuard>
  );
}
