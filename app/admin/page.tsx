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
