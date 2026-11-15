# Otel Preview qəbul testi — 14 noyabr 2026

## Müəyyən edilmiş mühit
- GitHub: `fatullaliagency/qr-menu`, `feature/hotel-module-v1` (qəbul skripti commit `127fd16f`).
- Vercel: `qr-menu-hotel-staging` / `prj_2AX2rvep2HL0X0hqjKZDuurYHHLy`.
- Ayrı Prisma Postgres resursu: `qr_menu_hotel_staging` / `store_XTQmpyxQp7ApQuzp`.
- Bütün database URL-ləri və login secret-lər yalnız Preview mühitindədir. Production üçün otel və superadmin flag-ləri false; restoran `ENABLE_WEB_ORDERS=false`.
- Preview saytları Vercel SSO ilə qorunur. Qoruma söndürülməyib.

## Migrasiya və nəticə
- Başlanğıcda yalnız öz otel bazasında yoxlama: `current_database=postgres`, `public` user-table count = **0**.
- Boş DB-də izlənən Prisma migrasiyaları icra olunub; səkkiz əsas cədvəlin mövcudluğu ayrıca təsdiqlənib.
- Vercel icrası: `dpl_2ZuHzVBHPPEA7b8v6ZsJwUMwxXSi` — migration success.
- Migrasiya sonrasında yeni bazanın məlumatları CI disposable DB backup/restore yoxlamaları ilə müqayisəli sınaqdan keçirilib. Canlı database backup/restore ayrıca icra edilməyib.

## Real Preview DB + Next.js production HTTP qəbul sınağı
- Skript: `scripts/hotel-staging-live-acceptance.mjs`.
- Vercel builder-də `next start` lokal işə salınıb, eyni ayrıca Preview database-ə qoşulub. SSO qorunan uzaq Preview hostuna adi HTTP GET etibarlı sınaq sayılmayıb.
- 2 təsadüfi adlı müvəqqəti test oteli, eyni nömrəli otaq, 5 kateqoriyalı xidmət və hər şöbə üçün sifariş/folio qaydası yoxlanılıb.
- 29 ASSERT PASS: QR tokeni, səhv/başqa otelin QR-si, bütün xidmətlərin görünməsi, 5 şöbə, gözləyən folio, otellərarası oxuma və status yazma izolasyonu, qonaq tracking tokeni, status yenilənməsi, təkrar sorğu identifikatoru, checkout qaydası, QR nonce rotasiyası və status audit.
- Nəticə: `HOTEL_LIVE_ACCEPTANCE_PASS: 29 assertions`.
- Təmizləmə: `HOTEL_LIVE_CLEANUP_SUCCESS`; test otelləri silinib.
- Bu sınaq **fiziki mobil brauzer sınağı deyil** və **real istifadəçi ilə superadmin autentifikasiyasının tamamlanması** demək deyil.

## Avtomatlaşdırılmış CI testləri
- Otel və restoran branch-isolation, TypeScript, Next build, PostgreSQL tenant izolasyonu, Chromium və WebKit browser E2E, folio, audit, QR, CSV və backup/restore ssenariləri.
- Əsas tətbiqin müvəqqəti CI test DB-sində təsdiqləndiyi, real Preview database-də isə 29 əlavə smoke sınağı aparıldığı bir-birindən ayrıdır.

## Qalan təsdiqlər
- [ ] Real iPhone Safari və Android Chrome: QR skan, kamera/səs/Notification icazələri, internet kəsilməsi və çap olunmuş fiziki QR.
- [ ] Hotel menecerinin və superadminin real giriş axını, istifadəçi tərəfindən seçilmiş gizli açar/PİN ilə qəbul aktı.
- [ ] Real otel operatorları tərəfindən SPA/transfer, folio, CSV və billing ekranlarının iş prosesində təsdiqi.
- [ ] Xarici PMS API və onlayn kart ödənişi: provayder inteqrasiyası və müqavilə təsdiqi, sınaq merchant hesabları.
- [ ] Ayrı production buraxılışı üçün backup, monitorinq və yazılı operator təsdiqi.

**Qərar:** İzolyasiya edilmiş Preview-də avtomatik qəbul testləri keçib. Real cihaz/operator qəbulundan və provayder asılılıqlarından əvvəl otel modulunu production-a çıxarmaq olmaz.
