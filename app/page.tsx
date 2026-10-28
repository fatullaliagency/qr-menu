
import { db } from "@/app/lib/db";
import {
  getAdminSession,
  requireAdminSession,
} from "@/app/lib/admin-auth";
import { revalidatePath } from "next/cache";
import Link from "next/link";

import AdminPinGuard from "./AdminPinGuard";
import ImagePickerInput from "./ImagePickerInput";
import QrCodeBox from "./QrCodeBox";

type AdminPageProps = {
  searchParams: Promise<{
    slug?: string | string[];
  }>;
};

// FORM MƏLUMATLARINI TƏHLÜKƏSİZ OXUMAQ

function readText(
  fd: FormData,
  key: string,
  maxLength = 2000
): string {
  const value = fd.get(key);

  if (typeof value !== "string") {
    throw new Error(`Yanlış forma məlumatı: ${key}`);
  }

  const text = value.trim();

  if (text.length > maxLength) {
    throw new Error(`Məlumat çox uzundur: ${key}`);
  }

  return text;
}

function readRequiredText(
  fd: FormData,
  key: string,
  maxLength = 200
): string {
  const text = readText(fd, key, maxLength);

  if (!text) {
    throw new Error(`Məcburi sahə boşdur: ${key}`);
  }

  return text;
}

function readPrice(fd: FormData): number {
  const raw = readRequiredText(fd, "price", 30);

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error("Qiymət formatı yanlışdır.");
  }

  const price = Number(raw);

  if (
    !Number.isFinite(price) ||
    price < 0 ||
    price > 999999.99
  ) {
    throw new Error("Qiymət düzgün deyil.");
  }

  return price;
}

function readImage(fd: FormData, key: string): string | null {
  const value = fd.get(key);

  if (typeof value !== "string") {
    throw new Error("Şəkil məlumatı yanlışdır.");
  }

  const image = value.trim();

  if (!image) {
    return null;
  }

  // Mövcud şəkil ünvanlarına icazə verilir.
  if (image.startsWith("https://") ||
      image.startsWith("http://")) {
    if (image.length > 2048) {
      throw new Error("Şəkil ünvanı çox uzundur.");
    }

    return image;
  }

  // Mövcud Base64 şəkil formatı ilə uyğunluq.
  if (
    image.length <= 700000 &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(
      image
    )
  ) {
    return image;
  }

  throw new Error(
    "Şəkil formatı və ya ölçüsü uyğun deyil."
  );
}

// HƏR SERVER ƏMƏLİYYATINDA İCAZƏ YOXLAMASI

async function authorizedRestaurant(fd: FormData) {
  const restaurantId = readRequiredText(
    fd,
    "restaurantId",
    150
  );

  await requireAdminSession(restaurantId);

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      slug: true,
    },
  });

  if (!restaurant) {
    throw new Error("Restoran tapılmadı.");
  }

  return restaurant;
}

function refreshRestaurant(slug: string) {
  revalidatePath("/admin");
  revalidatePath(`/${slug}`);
}

// 1. RESTORAN MƏLUMATLARINI YADDA SAXLA

async function saveRest(fd: FormData) {
  "use server";

  const restaurant = await authorizedRestaurant(fd);

  await db.restaurant.update({
    where: { id: restaurant.id },
    data: {
      name: readRequiredText(fd, "name"),
      phone: readRequiredText(fd, "phone", 100),
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

  refreshRestaurant(restaurant.slug);
}

// 2. KATEQORİYA ƏLAVƏ ET

async function addCat(fd: FormData) {
  "use server";

  const restaurant = await authorizedRestaurant(fd);
  const name = readRequiredText(fd, "name");

  await db.category.create({
    data: {
      name,
      restaurantId: restaurant.id,
    },
  });

  refreshRestaurant(restaurant.slug);
}

// 3. KATEQORİYANI REDAKTƏ ET

async function editCat(fd: FormData) {
  "use server";

  const restaurant = await authorizedRestaurant(fd);
  const id = readRequiredText(fd, "id", 150);
  const name = readRequiredText(fd, "name");

  const result = await db.category.updateMany({
    where: {
      id,
      restaurantId: restaurant.id,
    },
    data: { name },
  });

  if (result.count !== 1) {
    throw new Error("Kateqoriya tapılmadı.");
  }

  refreshRestaurant(restaurant.slug);
}

// 4. KATEQORİYANI SİL

async function delCat(fd: FormData) {
  "use server";

  const restaurant = await authorizedRestaurant(fd);
  const id = readRequiredText(fd, "id", 150);

  await db.$transaction(async (tx) => {
    const category = await tx.category.findFirst({
      where: {
        id,
        restaurantId: restaurant.id,
      },
      select: { id: true },
    });

    if (!category) {
      throw new Error("Kateqoriya tapılmadı.");
    }

    await tx.menuItem.deleteMany({
      where: {
        categoryId: id,
        restaurantId: restaurant.id,
      },
    });

    const result = await tx.category.deleteMany({
      where: {
        id,
        restaurantId: restaurant.id,
      },
    });

    if (result.count !== 1) {
      throw new Error("Kateqoriya silinmədi.");
    }
  });

  refreshRestaurant(restaurant.slug);
}

// 5. MƏHSUL ƏLAVƏ ET

async function addItem(fd: FormData) {
  "use server";

  const restaurant = await authorizedRestaurant(fd);

  const name = readRequiredText(fd, "name");
  const categoryId = readRequiredText(
    fd,
    "categoryId",
    150
  );
  const price = readPrice(fd);
  const description = readText(
    fd,
    "description",
    2000
  );
  const imageUrl = readImage(fd, "imageUrl");

  const category = await db.category.findFirst({
    where: {
      id: categoryId,
      restaurantId: restaurant.id,
    },
    select: { id: true },
  });

  if (!category) {
    throw new Error(
      "Seçilmiş kateqoriya bu restorana aid deyil."
    );
  }

  await db.menuItem.create({
    data: {
      name,
      price,
      description: description || null,
      imageUrl,
      categoryId: category.id,
      restaurantId: restaurant.id,
    },
  });

  refreshRestaurant(restaurant.slug);
}

// 6. MƏHSULU REDAKTƏ ET

async function editItem(fd: FormData) {
  "use server";

  const restaurant = await authorizedRestaurant(fd);

  const id = readRequiredText(fd, "id", 150);
  const name = readRequiredText(fd, "name");
  const price = readPrice(fd);
  const description = readText(
    fd,
    "description",
    2000
  );
  const imageUrl = readImage(fd, "imageUrl");

  const result = await db.menuItem.updateMany({
    where: {
      id,
      restaurantId: restaurant.id,
    },
    data: {
      name,
      price,
      description: description || null,
      imageUrl,
    },
  });

  if (result.count !== 1) {
    throw new Error("Məhsul tapılmadı.");
  }

  refreshRestaurant(restaurant.slug);
}

// 7. MƏHSULU SİL

async function delItem(fd: FormData) {
  "use server";

  const restaurant = await authorizedRestaurant(fd);
  const id = readRequiredText(fd, "id", 150);

  const result = await db.menuItem.deleteMany({
    where: {
      id,
      restaurantId: restaurant.id,
    },
  });

  if (result.count !== 1) {
    throw new Error("Məhsul tapılmadı.");
  }

  refreshRestaurant(restaurant.slug);
}

// ADMIN SƏHİFƏSİ

export default async function AdminPage({
  searchParams,
}: AdminPageProps) {
  const params = await searchParams;

  const activeSlug =
    typeof params.slug === "string" &&
    params.slug.trim()
      ? params.slug.trim()
      : "fatullali";

  // Əvvəl sessiyanı yoxlayırıq.
  const session = await getAdminSession();

  if (!session) {
    return (
      <AdminPinGuard restaurantSlug={activeSlug}>
        {null}
      </AdminPinGuard>
    );
  }

  // Yalnız lazım olan sahələri oxuyuruq.
  // Admin PIN-i heç bir Client Component-ə ötürülmür.
  const restaurant = await db.restaurant.findUnique({
    where: { slug: activeSlug },
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
    return (
      <div className="p-10 text-center text-red-600 font-bold">
        Restoran tapılmadı!
      </div>
    );
  }

  // Başqa restoranın admin panelini açmağa icazə yoxdur.
  if (session.restaurantId !== restaurant.id) {
    return (
      <AdminPinGuard restaurantSlug={activeSlug}>
        {null}
      </AdminPinGuard>
    );
  }

  const inp =
    "w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm bg-white text-zinc-900";

  return (
    <AdminPinGuard
      restaurantSlug={restaurant.slug}
      initialAuthenticated={true}
    >
      <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-gray-800">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* BAŞLIQ */}
          <div className="flex flex-wrap justify-between items-center gap-3 bg-white p-5 rounded-2xl shadow-sm">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-zinc-900">
                {restaurant.name} — İdarəetmə Paneli
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Restoran və menyu idarəetməsi
              </p>
            </div>

            <Link
              href={`/${restaurant.slug}`}
              target="_blank"
              className="bg-zinc-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
            >
              Menyuya Bax ↗
            </Link>
          </div>

          <QrCodeBox
            slug={restaurant.slug}
            restaurantName={restaurant.name}
          />

          {/* RESTORAN MƏLUMATLARI */}
          <form
            action={saveRest}
            className="bg-white p-6 rounded-2xl shadow-sm border border-amber-200 space-y-4"
          >
            <input
              type="hidden"
              name="restaurantId"
              value={restaurant.id}
            />

            <h2 className="font-bold text-lg">
              👑 Restoran Loqosu, Arxa Plan və Məlumatlar
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ImagePickerInput
                name="logoUrl"
                label="1. Loqo Şəkli"
                defaultValue={restaurant.logoUrl ?? ""}
              />
              <ImagePickerInput
                name="bgImageUrl"
                label="2. Arxa Plan"
                defaultValue={restaurant.bgImageUrl ?? ""}
              />
              <ImagePickerInput
                name="heroFoodUrl"
                label="3. Vitrin Şəkli"
                defaultValue={restaurant.heroFoodUrl ?? ""}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                name="name"
                defaultValue={restaurant.name}
                placeholder="Restoran Adı"
                required
                className={inp}
              />
              <input
                name="subtitle"
                defaultValue={restaurant.subtitle ?? ""}
                placeholder="Alt Başlıq"
                className={inp}
              />
              <input
                name="slogan"
                defaultValue={restaurant.slogan ?? ""}
                placeholder="Sloqan"
                className={inp}
              />
              <input
                name="description"
                defaultValue={restaurant.description ?? ""}
                placeholder="Açıqlama"
                className={inp}
              />
              <input
                name="wifiName"
                defaultValue={restaurant.wifiName ?? ""}
                placeholder="Wi-Fi Adı"
                className={inp}
              />
              <input
                name="wifiPassword"
                defaultValue={restaurant.wifiPassword ?? ""}
                placeholder="Wi-Fi Şifrəsi"
                className={inp}
              />
              <input
                name="phone"
                defaultValue={restaurant.phone}
                placeholder="Telefon / WhatsApp"
                required
                className={inp}
              />
              <input
                name="address"
                defaultValue={restaurant.address ?? ""}
                placeholder="Ünvan"
                className={inp}
              />
              <input
                name="workingHours"
                defaultValue={restaurant.workingHours ?? ""}
                placeholder="İş Saatları"
                className={`${inp} md:col-span-2`}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl shadow-md cursor-pointer"
            >
              💾 Restoran Məlumatlarını Yadda Saxla
            </button>
          </form>

          {/* KATEQORİYA VƏ MƏHSUL ƏLAVƏ ET */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form
              action={addCat}
              className="bg-white p-6 rounded-2xl shadow-sm space-y-3 h-fit"
            >
              <input
                type="hidden"
                name="restaurantId"
                value={restaurant.id}
              />

              <h2 className="font-bold text-lg">
                ➕ Yeni Kateqoriya Əlavə Et
              </h2>

              <input
                name="name"
                placeholder="Məs: İsti İçkilər, Kabablar..."
                required
                className={inp}
              />

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl cursor-pointer"
              >
                Kateqoriya Yarat
              </button>
            </form>

            <form
              action={addItem}
              className="bg-white p-6 rounded-2xl shadow-sm space-y-3"
            >
              <input
                type="hidden"
                name="restaurantId"
                value={restaurant.id}
              />

              <h2 className="font-bold text-lg">
                🍔 Yeni Məhsul Əlavə Et
              </h2>

              <select
                name="categoryId"
                required
                defaultValue=""
                className={inp}
              >
                <option value="">
                  -- Kateqoriya Seçin --
                </option>
                {restaurant.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <input
                name="name"
                placeholder="Məhsulun Adı"
                required
                className={inp}
              />

              <input
                type="number"
                min="0"
                max="999999.99"
                step="0.01"
                name="price"
                placeholder="Qiymət (₼)"
                required
                className={inp}
              />

              <input
                name="description"
                placeholder="Tərkibi / Açıqlama"
                className={inp}
              />

              <ImagePickerInput
                name="imageUrl"
                label="Məhsulun Şəkli"
              />

              <button
                type="submit"
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-2.5 rounded-xl cursor-pointer"
              >
                Məhsulu Menyuya Əlavə Et
              </button>
            </form>
          </div>

          {/* MÖVCUD MENYU */}
          <div className="bg-white p-6 rounded-2xl shadow-sm space-y-5">
            <h2 className="font-bold text-xl">
              📋 Mövcud Menyu Siyahısı
            </h2>

            {restaurant.categories.map((cat) => (
              <div
                key={cat.id}
                className="border border-gray-200 rounded-2xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <form
                    action={editCat}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="hidden"
                      name="restaurantId"
                      value={restaurant.id}
                    />
                    <input
                      type="hidden"
                      name="id"
                      value={cat.id}
                    />
                    <input
                      name="name"
                      defaultValue={cat.name}
                      required
                      className="font-bold text-base border border-gray-300 rounded-lg px-3 py-1 bg-white min-w-0"
                    />
                    <button
                      type="submit"
                      className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                    >
                      Adı Dəyiş
                    </button>
                  </form>

                  <form action={delCat}>
                    <input
                      type="hidden"
                      name="restaurantId"
                      value={restaurant.id}
                    />
                    <input
                      type="hidden"
                      name="id"
                      value={cat.id}
                    />
                    <button
                      type="submit"
                      className="text-red-600 hover:text-red-700 text-xs font-bold"
                    >
                      🗑️ Kateqoriyanı Sil
                    </button>
                  </form>
                </div>

                {cat.menuItems.map((item) => (
                  <div
                    key={item.id}
                    className="py-3 border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      id={`edit_${item.id}`}
                      className="peer hidden"
                    />

                    <div className="flex justify-between items-center gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-14 h-14 rounded-xl object-cover border shrink-0"
                          />
                        )}

                        <div className="min-w-0">
                          <div className="font-bold text-zinc-900">
                            {item.name}
                          </div>
                          {item.description && (
                            <div className="text-xs text-gray-500">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-emerald-600 text-sm">
                          {item.price.toFixed(2)} ₼
                        </span>

                        <label
                          htmlFor={`edit_${item.id}`}
                          className="cursor-pointer bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl"
                        >
                          ✏️ Düzənlə
                        </label>

                        <form action={delItem}>
                          <input
                            type="hidden"
                            name="restaurantId"
                            value={restaurant.id}
                          />
                          <input
                            type="hidden"
                            name="id"
                            value={item.id}
                          />
                          <button
                            type="submit"
                            className="bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold px-3 py-2 rounded-xl"
                          >
                            🗑️ Sil
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* MƏHSUL REDAKTƏ FORMASI */}
                    <form
                      action={editItem}
                      className="hidden peer-checked:block mt-3 bg-amber-50/40 p-4 rounded-xl border border-amber-200 space-y-3"
                    >
                      <input
                        type="hidden"
                        name="restaurantId"
                        value={restaurant.id}
                      />
                      <input
                        type="hidden"
                        name="id"
                        value={item.id}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">
                            Məhsulun Adı
                          </label>
                          <input
                            name="name"
                            defaultValue={item.name}
                            required
                            className={inp}
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">
                            Qiymət (₼)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="999999.99"
                            step="0.01"
                            name="price"
                            defaultValue={item.price}
                            required
                            className={inp}
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">
                            Tərkibi / Açıqlama
                          </label>
                          <input
                            name="description"
                            defaultValue={item.description ?? ""}
                            className={inp}
                          />
                        </div>
                      </div>

                      <ImagePickerInput
                        name="imageUrl"
                        label="Yeni Şəkil Seç (Qalereyadan)"
                        defaultValue={item.imageUrl ?? ""}
                      />

                      <button
                        type="submit"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl"
                      >
                        💾 Dəyişiklikləri Yadda Saxla
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminPinGuard>
  );
}
