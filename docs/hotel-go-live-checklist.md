# Otel modulu — istifadəyə buraxılış və real cihaz qəbul siyahısı

Bu sənəd texniki test nəticələrini **real otel mühitində qəbul** əvəzinə keçirmir. `main` və restoran staging mühitləri dəyişdirilməməlidir.

## Ayrı canlı test mühiti — məcburi ön şərtlər
- [x] Restoran staging və production-dan ayrı Vercel Prisma Postgres resursu `qr_menu_hotel_staging` yaradılıb; store ID və Preview-only project association yoxlanıb.
- [x] `qr-menu-hotel-staging` yaradılıb; `feature/hotel-module-v1` Preview-də otel və superadmin açıqdır, Production-da isə bağlıdır.
- [x] Yeni otel DB-nin `DATABASE_URL` dəyişəni yalnız Preview-yə həssas/sensitive olaraq bağlanıb; yerləşdirmə edilib.
- [x] `ENABLE_HOTEL_MODULE=true`, `ENABLE_SUPERADMIN_PANEL=true` yalnız otel Preview-dədir; Production-da false; `ENABLE_WEB_ORDERS=false` hər iki mühitdədir.
- [x] Yeni test DB-də `public` cədvəllərinin sayı 0 təsdiqlənib və izlənən Prisma migrasiyaları yalnız onun üzərində tətbiq edilib; ayrıca CI-də pg_dump/pg_restore sınağı keçib. Bazada ilkin məlumat olmadığından migrasiyaöncəsi məlumat backup-ı mövcud deyil.
- [x] Ayrı `ADMIN_SESSION_SECRET` və `SUPERADMIN_ACCESS_KEY` Vercel Preview-də Sensitive rejimində var; dəyərlər hesabatda/logda yoxdur.

## Manual qəbul testi — telefon və real səslə
- [ ] Android Chrome və iOS Safari: otaq QR-ni skan et; yalnız müvafiq otaq açılsın.
- [ ] Boş otağa sifariş getməsin; otaq boşaldıldıqdan sonra köhnə QR etibarsızlaşsın.
- [ ] İstənilən qalma dövründə gözləyən otaq hesabı olduqda checkout rədd edilsin; `OCCUPIED → OUT_OF_SERVICE → VACANT` keçidi ilə məhdudiyyəti yan keçmək mümkün olmasın; menecer qeydi təsdiq/ləğv etdikdən sonra checkout mümkün olsun.
- [ ] Yemək, dəsmal və transfer müraciətlərini eyni səbətdə göndər; üç müstəqil şöbə qeydini yoxla.
- [ ] Fərdi əməkdaş ilə giriş et; başqa şöbə, hotel admin və billing qadağan olunsun.
- [ ] Menecer PİN-i olmadan otaq hesabı təsdiqlənə bilməsin; tamamlanmamış sifariş təsdiqlənməsin.
- [ ] Yeni sifarişin vizual/səsli bildirişi fiziki telefonda test edilsin; brauzer bağlı olanda push zəmanəti yoxdur.
- [ ] Qonağın izləmə ekranı status dəyişikliyini əks etdirsin; brauzer bildirişi yalnız könüllü icazə ilə alınsın.
- [ ] İki otelin eyni nömrəli otaqları, sifarişləri və əməkdaşları bir-birinə görünməsin.
- [ ] Aşağı internet sürəti, internet kəsilməsi, təkrar klik, yanlış token və bərpa ssenariləri keçsin.

## Hesablaşma və hüquqi təsdiq
- [ ] Otaq hesabı `PENDING → APPROVED` yalnız daxili təsdiqdir; pul alınması və ya PMS postings hesablanmır.
- [ ] Mövcud otel sifarişləri varsa, ledger və `stayKey=legacy` qeydləri üçün ayrıca uzlaşdırma/backfill planı hazırlanıb.
- [x] Menecerin yalnız öz otelinə aid otaq hesablarını UTC tarix intervalı ilə CSV kimi çıxarması və formula injection qorunması kodlaşdırılıb.
- [ ] Real PMS provayderi, API sənədi, müqavilə və təhlükəsiz təsdiq olmadan PMS bağlantısı edilməyib.
- [ ] Onlayn kart ödənişi provayder təsdiqi və webhook mühafizəsi olmadan aktiv edilməyib.

## İstifadəyə buraxılış qərarı
- [x] Otel/restaurant CI, PostgreSQL izolasiya, Chromium/WebKit E2E, TypeScript və Next.js build uğurlu yoxlamalardan keçib.
- [x] İzolyasiya edilmiş Preview PostgreSQL ilə lokal production Next HTTP serverində 29 yoxlama PASS olub, QA otelləri silinib; `docs/hotel-acceptance-2026-11-14.md` sənədində qeyd olunub.
- [ ] Otel meneceri və sifariş operatorları real cihaz qəbulunu təsdiqləyib.
- [ ] Data migration və rollback planı yoxlanıb; ayrıca production release razılığı alınıb.

**Cari vəziyyət:** ayrı canlı otel test bazası və real cihaz qəbul testi təsdiqlənmədiyi üçün production release etmək olmaz.

## Isolated staging enablement
- [x] `qr-menu-hotel-staging` Preview aktiv, Production deaktiv saxlanılıb; superadmin Preview daxilində giriş tələb edir.
- [x] Yeni, boş database üçün explicit approval / DB-name / table-emptiness preflight skripti hazırlanıb.
- [x] Tam müstəqil PostgreSQL yaradılıb; yalnız boş DB-də Vercel-in müvəqqəti, yoxlamalı Preview build skripti vasitəsilə `prisma migrate deploy` tətbiq edilib.
- [x] Otel layihəsinə Preview-only encrypted database URL və ayrıca auth açarları bağlanıb.

## Əlavə CI qəbul testləri
- [x] Chromium ilə end-to-end qonaq QR, sifariş, RBAC, checkout, otaq hesabı və CSV yoxlaması.
- [x] WebKit (iOS Safari-yə yaxın mühərrik) və Chromium ilə disposable PostgreSQL üzərində brauzer sınaqları CI-də keçib.
- [x] Otel əməliyyat məlumatlarının pg_dump/pg_restore ilə ayrı disposable PostgreSQL üzərində bərpası CI-də keçib.
- [ ] Bu testlər real iPhone/Android cihazları və real otel qəbul aktını əvəz etmir.

## Fiziki telefon sınağı (ayrıca modul söndürülmüşkən də mümkündür)
- [x] Test səhifəsi kodu əlavə olunub: /hotel-device-check; yalnız HOTEL_DEVICE_CHECK_ENABLED=true olan layihədə açılır.
- [ ] Otel staging linkini real iPhone Safari və Android Chrome-da açıb kamera/səs/bildiriş testlərini yerinə yetirin.
- [ ] Test nəticəsi istifadəçinin razılığı ilə kopyalanıb, qəbul qərarı qeyd edilib; səhifə heç bir görüntünü və şəxsi məlumatı serverə göndərmir.
- [x] Ayrıca otel PostgreSQL bağlantısı və migrasiyaları hazırdır. Real cihazdan QR sifarişi və səsli bildiriş isə hələ manual yoxlama tələb edir.

## Otaq QR toplu çapı
- [x] Otel meneceri üçün yalnız öz otelini göstərən `/hotel-admin/rooms/print` səhifəsi (hər səhifədə 24 QR).
- [x] QR-lər üçüncü tərəfə ötürülmədən yalnız brauzerdə yaradılır; çap vərəqi paylaşılmamalıdır.
- [ ] Çapdan sonra otaq nömrələrinin fiziki otaqlara düzgün bağlandığı real cihazda yoxlanılıb.
- [ ] Otaq boşaldıqda QR yenilənir; köhnə çap vərəqlərinin ləğvi qəbulla təsdiqlənib.

## Otaq statusu audit tarixçəsi
- [x] Otağın menecer tərəfindən status dəyişməsi atomik audit hadisəsi olaraq saxlanır: əvvəlki/yeni status, vaxt, QR yenilənməsi, icraçı.
- [x] Tarixçə yalnız menecerin öz otelində görünür: `/hotel-admin/rooms/history` (40 qeyd/səhifə), bearer QR tokeni saxlanmır.
- [x] CI-də status keçidləri, otellərarası izolasiya və PostgreSQL backup/restore üzrə audit cədvəli avtomatik yoxlanılır.
- [ ] Real otel meneceri status keçidlərini və audit görünüşünü qəbul edib.

## Transfer və SPA ayrıca şöbələr
- [x] Transfer və SPA xidmətləri ayrıca kateqoriya, sifariş şöbəsi, əməkdaş PİN icazəsi və status bildirişi kimi əlavə edilib.
- [x] Superadmin otel yaradarkən və otel meneceri işlək bölmələri seçərkən ayrıca transfer/SPA checkbox-ları göstərilir.
- [x] RESTAURANT və sifariş migrationları dəyişdirilməyib; Prisma üçün əlavə otel enum/flag migrasiyası var.
- [x] Müstəqil otel Preview PostgreSQL-də SPA/transfer sifarişlərinin şöbələrə ayrılması və tracking HTTP sınaqları yoxlanılıb. Fiziki telefon bildirişləri hələ təsdiqlənməyib.

## Superadmin yaradılışı — əlavə avtomatlaşdırılmış qəbul
- [x] Yeni CI testi: disposable PostgreSQL üzərində superadmin PİN-dən fərqli CI-only 32+ simvolluq giriş açarı ilə UI login, iki otaqlı otelin yaradılması, yeni otel menecerinin ayrıca PIN girişi, öz otaq QR-ləri, tenant izolasiya və superadmin logout yoxlanır.
- [ ] Real Preview-də istifadəçi özü təyin etdiyi gizli `SUPERADMIN_ACCESS_KEY` ilə login və iki otel yaradılmasını təsdiq etməlidir; CI-only açar burada istifadə olunmur.

## Superadmin logout təhlükəsizliyi
- [x] Superadmin çıxışı yalnız same-origin POST ilə `/superadmin/logout` marşrutundan 303 yönləndirmə edir; çıxış kukisi birbaşa `NextResponse.cookies.set` vasitəsilə path-matched `Max-Age=0` və `Expires` ilə silinir.
- [x] CI e2e-də cross-origin logout sorğusunun 403 olması, çıxışdan sonra serverin protected `/superadmin/hotels/new` səhifəsində yeni otel formasını göstərməməsi yoxlanır.
