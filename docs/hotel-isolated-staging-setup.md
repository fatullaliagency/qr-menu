# İzolyasiya edilmiş otel staging — qoşulma və aktivləşdirmə

**Mövcud Vercel layihəsi:** `qr-menu-hotel-staging` (ayrıca layihə; ID `prj_2AX2rvep2HL0X0hqjKZDuurYHHLy`). Bu layihədə ilkin olaraq `ENABLE_HOTEL_MODULE=false`, `ENABLE_WEB_ORDERS=false`, `ENABLE_SUPERADMIN_PANEL=false` təyin edilib. Mövcud `qr-menu-staging` və `qr-menu` layihələrinə toxunmayın.

## 1. Müstəqil PostgreSQL təminatı (hələ edilmir)
1. İdarə etdiyiniz PostgreSQL provayderində **yeni, boş və ayrıca** database yaradın. Dəqiq adı `qr_menu_hotel_staging` olsun.
2. Provayder panelindən bu DB-nin restoran staging və production bazalarından ayrı olduğunu doğrulayın. Təkcə URL adına güvənməyin: host/instance, database identifikatoru və layihə bağlanmasını qarşılaşdırın.
3. DB parolunu, tokenləri və `DATABASE_URL` sətirini heç vaxt GitHub commit-də, söhbətdə və ya logda paylaşmayın.
4. Quraşdırmanı yalnız `feature/hotel-module-v1` branch-ində lokal/izolyasiya olunmuş icra mühitində aparın; köhnə restoran migration bağlantısını istifadə etməyin.

## 2. İlkin Prisma migrasiyası (yalnız BOŞ test DB)
`DATABASE_URL` yeni, boş test DB-ni göstərməlidir. `HOTEL_TEST_DB_APPROVAL=INITIALIZE_ISOLATED_HOTEL_TEST` təyin edib `npm run hotel:test-db:init` işlədin. Skript:
- xüsusi **hotel test DB adı** və açıq təsdiq tələb edir;
- `RESTAURANT_STAGING_DATABASE_URL` / `PRODUCTION_DATABASE_URL` ayrıca təqdim edilibsə onların eyni database olmasını rədd edir;
- `public` sxemində hər hansı cədvəl varsa migrasiyanı dayandırır;
- yalnız boş test DB təsdiqlənəndən sonra `prisma migrate deploy` işlədir.

Bu bir dəfəlik **ilkin** quraşdırmadır; mövcud bazada təkrar işə salmayın. Yeni migration versiyaları üçün ayrıca backup və təsdiqlənmiş dəyişiklik prosesi lazımdır.

## 3. Vercel layihəsinə müstəqil DB qoşulması
Vercel layihəsi yalnız `qr-menu-hotel-staging` olmalıdır. **Encrypted/sensitive** mühit dəyişənləri kimi yalnız otel DB `DATABASE_URL`, ayrıca təsadüfi `ADMIN_SESSION_SECRET` (ən az 32 simvol), `SUPERADMIN_ACCESS_KEY` (ən az 32 simvol) saxlayın. Onları restoran layihələrindən kopyalamayın.

DB migrasiyası və izolasiya yoxlaması təsdiqləndikdən sonra yalnız bu **otel** layihəsində `ENABLE_HOTEL_MODULE=true`, `ENABLE_SUPERADMIN_PANEL=true` edin. `ENABLE_WEB_ORDERS=false` restoran sifarişlərinin bu mühitdə təsadüfən yaradılmaması üçün qalır. Yenidən otel feature branch-inin son uğurlu CI commit-ini deploy edin.

## 4. Canlı qəbul və geri dönmə
- İki test oteli yaradın; eyni nömrəli otaqların QR-si, şöbə rol məhdudiyyəti, idempotent sifariş, checkout, otaq hesabı və CSV export-u yoxlayın.
- Android Chrome və iOS Safari üzərində real QR kamera, səs, brauzer icazəsi testləri ayrıca operator tərəfindən edilməlidir.
- Problem olarsa ilk addım bu otel layihəsində `ENABLE_HOTEL_MODULE=false` edib otel preview-i yenidən yerləşdirməkdir; restorana və production bazasına toxunmayın.
- Canlı PMS/bank bağlantısı provider API sənədləri və icazələri olmadan həyata keçirilmir. CSV yalnız daxili üzləşdirmə üçündür.

**Status:** yeni Vercel layihəsi hazırlanıb, lakin ayrıca PostgreSQL mənbəyi/provayder bağlantısı bu sessiyada mövcud olmadığı üçün real DB quraşdırılması və canlı qəbul işləri qəsdən gözləyir.

## Vercel Prisma Postgres (2026-11-14)
- Ayrıca `qr_menu_hotel_staging` Vercel Prisma Postgres resursu `store_XTQmpyxQp7ApQuzp` yalnız `qr-menu-hotel-staging` Preview mühitinə qoşulub. Əsl daxili PostgreSQL adı `postgres` ola bilər; UI resurs adı ilə qarışdırmayın.
- `scripts/hotel-staging-database-maintenance.mjs` yalnız preview build, düzgün Vercel project/branch, deaktiv runtime və boş user-table yoxlaması ilə `inspect` və `initialize` əməliyyatlarını icra edir. Gizli URL və şifrələr loglara çıxarılmır.
- İcra üçün **müvəqqəti** Vercel build override istifadə olunur; iş bitən kimi buildCommand `null` vəziyyətinə qaytarılmalıdır. `initialize` bir dəfə icra olunmalıdır. Yeni migrasiyalar üçün ayrıca təsdiq və backup tələb olunur.
