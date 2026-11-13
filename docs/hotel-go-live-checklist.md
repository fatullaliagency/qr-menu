# Otel modulu — istifadəyə buraxılış və real cihaz qəbul siyahısı

Bu sənəd texniki test nəticələrini **real otel mühitində qəbul** əvəzinə keçirmir. `main` və restoran staging mühitləri dəyişdirilməməlidir.

## Ayrı canlı test mühiti — məcburi ön şərtlər
- [ ] Restoran staging-dən və production-dan **ayrı PostgreSQL** otel test bazası yaradılıb, DB identifikatoru ayrıca təsdiq edilib.
- [x] Ayrı `qr-menu-hotel-staging` Vercel layihəsi yaradılıb (preview source: `feature/hotel-module-v1`); otel, sifariş və superadmin funksiyaları ayrıca DB hazır olana qədər bağlıdır.
- [ ] Layihəyə otel test bazasının ayrıca `DATABASE_URL` dəyəri təhlükəsiz şəkildə qoşulub; layihə canlı test üçün yenidən yerləşdirilib.
- [ ] `ENABLE_HOTEL_MODULE=true` yalnız həmin izolyasiya olunmuş mühitdədir; restoran və production mühitində deaktivdir.
- [ ] Migrasiya öncəsi backup yaradılıb və bərpası yoxlanılıb; `prisma migrate deploy` yalnız ayrıca DB-də icra olunub.
- [ ] Session secret və superadmin açarları Vercel mühitində mövcuddur; dəyərləri heç bir logda paylaşılmır.

## Manual qəbul testi — telefon və real səslə
- [ ] Android Chrome və iOS Safari: otaq QR-ni skan et; yalnız müvafiq otaq açılsın.
- [ ] Boş otağa sifariş getməsin; otaq boşaldıldıqdan sonra köhnə QR etibarsızlaşsın.
- [ ] Qalma dövründə gözləyən otaq hesabı olduqda checkout rədd edilsin; menecer qeydi təsdiq/ləğv etdikdən sonra checkout mümkün olsun.
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
- [ ] Cari branch üçün otel CI, restoran regressiyası, PostgreSQL isolation, Chromium E2E, TS və Next build SUCCESS.
- [ ] Canlı izolyasiya edilmiş sınaqdan loglar və nəticələr toplanıb.
- [ ] Otel meneceri və sifariş operatorları real cihaz qəbulunu təsdiqləyib.
- [ ] Data migration və rollback planı yoxlanıb; ayrıca production release razılığı alınıb.

**Cari vəziyyət:** ayrı canlı otel test bazası və real cihaz qəbul testi təsdiqlənmədiyi üçün production release etmək olmaz.

## Isolated staging enablement
- [x] `qr-menu-hotel-staging` layihəsi yaradılıb və bütün modul flag-ləri qapalıdır.
- [x] Yeni, boş database üçün explicit approval / DB-name / table-emptiness preflight skripti hazırlanıb.
- [ ] Tam müstəqil PostgreSQL yaradılıb və `npm run hotel:test-db:init` yalnız onun üzərində icra edilib.
- [ ] Otel layihəsinə encrypted database URL və ayrıca auth açarları bağlanıb.
