# Otel modulu — production keçid planı və qəbul protokolu

> Status: **RELEASE BLOCKED — operator və fiziki cihaz qəbulu gözlənilir.**
> Hazırlanma tarixi: 15 noyabr 2026. Bu sənəd təsdiq aktı deyil və heç bir production əməliyyatını avtomatik icra etmir.

## 1. Dəqiq hədəf və sübutlar

- Repo: `fatullaliagency/qr-menu`; işçi branch: `feature/hotel-module-v1`.
- Son mobil sınaq commit-i: `8933a68ae9c43b9c0e2ff161a166533019a2f2f8`; bu commit yalnız `tests/integration/hotel-browser-e2e.test.mjs` faylını dəyişir.
- Otel CI: https://github.com/fatullaliagency/qr-menu/actions/runs/43616095926 — **SUCCESS**, Chromium 16/16, WebKit 16/16, ayrı test DB-də backup/restore.
- Restoran regresiyası: https://github.com/fatullaliagency/qr-menu/actions/runs/43616095929 — **SUCCESS**.
- Otel Preview: `qr-menu-hotel-staging`, deployment `dpl_BDuDX7L3vqj86FD53g7ZdYjy4Ej6`, tətbiq commit-i `3259f7f4b0828f609b3bb5dc8893ddac7766123d`, **READY**.
- Preview ünvanı: https://qr-menu-hotel-staging-i4du9d64m-fatullali.vercel.app
- Fiziki cihaz diaqnostikası: https://qr-menu-hotel-staging-i4du9d64m-fatullali.vercel.app/hotel-device-check
- Qəbul qərarları və sübutlar: https://github.com/fatullaliagency/qr-menu/issues/2
- SSO qoruması aktivdir; Preview-də superadmin/otel aktiv, otel layihəsinin Production mühitində deaktivdir.
- Avtomatik testlər fiziki telefonun, operatorun və ödəniş provayderinin real qəbulunu sübut **etmir**.

## 2. Manual qəbul matrisi — həqiqi cihazlarda

İcraçı hər addım üzrə tarix, cihaz, brauzer, operator rolu və **PASS/FAIL** yazmalıdır. PİN, session cookie, QR tokeni, bank məlumatı və müştəri məlumatı qeyd edilməməlidir.

| ID | Addım | PASS meyarı |
|---|---|---|
| M01 | Android telefon, Chrome: otaq QR-ni kamera ilə skan | Yalnız doğru otel və otaq açılır |
| M02 | iPhone, Safari: eyni QR | Eyni nəticə, görüntü təhrif olmur |
| M03 | Kamera, səs və bildiriş diaqnostikası | İcazə sorğusu düzgün görünür, səs fiziki olaraq eşidilir; dəstəklənməyən bildiriş ayrıca qeyd edilir |
| M04 | Yemək + dəsmal + transfer eyni səbətdə | Müraciətlər düzgün şöbələrə ayrı düşür və bir izləmə axını ilə görünür |
| M05 | Menecer və fərdi əməkdaş hesabları | Əməkdaş başqa otelin/şöbənin məlumatlarını və billing-i aça bilmir |
| M06 | Boş otaq və köhnəlmiş QR | Sifariş qadağası və köhnə QR etibarsızlığı real cihazda təsdiqlənir |
| M07 | Yarımçıq xidmət və gözləyən hesabla checkout | Checkout bloklanır; statusu dolayısı ilə dəyişmək qadağan edilir |
| M08 | Xidmət tamamlanması və otaq hesabı | Menecerin təsdiqi işləyir, maliyyə məbləği daxili hesabat kimi görünür |
| M09 | SPA/transfer, CSV, otaq status audit jurnalı | Doğru şöbələr və qeyd tarixi; başqa otelin məlumatı yoxdur |
| M10 | Şəbəkə kəsilməsi, yavaş internet, təkrar klik | Məlumat qarışmır; istifadəçiyə bərpa mesajı göstərilir, təkrarlanan sifariş yaranmır |
| M11 | Otaq QR-lərinin çapı və divarda yoxlanması | Çap edilmiş vərəqin fiziki otağa uyğunluğu və QR-nin bərpası doğrulanır |
| M12 | Superadminin real Preview girişi, otel yaradılması və çıxışı | İki sınaq oteli yaradılır, hərəsinin menecer PİN-i işləyir, çıxışdan sonra qorunan forma açılmır |

`M03`: mobil bildiriş icazəsi **push-un brauzer bağlanandan sonra çatdığına zəmanət vermir**; iOS üçün quraşdırılmış PWA tələbi və brauzer məhdudiyyətləri ayrıca yazılmalıdır.

**Qeyd:** testi keçmiş saymaq üçün real telefon nəticəsi, ekran təsdiqi və məsul operatorun təsdiqi lazımdır. CI nəticələri M01–M12 statusuna avtomatik keçirilməməlidir.

## 3. Operatorun imzalayacağı qəbul qeydi

```text
Tarix və saat:
Test Preview URL və deployment ID:
Otel operatorunun rolu/adı:
Android modeli / OS / Chrome:
iPhone modeli / iOS / Safari:
M01–M12 nəticələri (PASS/FAIL, hər fail üçün qısa izah):
Səs fiziki eşidildi? Bəli/Xeyr:
Bildiriş cihazda göründü? Bəli/Xeyr/Dəstəklənmir:
Otaq QR çapı real otaqda təsdiqləndi? Bəli/Xeyr:
PMS və kart ödənişi aktivdirmi? Xeyr / yalnız ayrıca müqavilə ilə:
Qalıq risklər, alınmayan sübutlar:
Qəbul edən şəxs və təsdiq tarixi:
```

Bu protokol Issue #2-yə əlavə olunsun. Giriş açarları, müştəri məlumatları və bearer tokenlər paylaşılmasın.

## 4. Production üçün sərt keçid şərtləri

Production əməliyyatı yalnız **hamısı** yerinə yetirildikdən sonra icra edilə bilər:

1. M01–M12 müvafiq real cihaz/operatorla uğurludur, qalıq risklər yazılı qəbul edilib.
2. Otel və restoran CI-nin eyni yekun inteqrasiya commit-i üzrə yaşıl olması təsdiqlənib. Yalnız otel feature branch-inin testi `main` inteqrasiyasını təsdiqləmir.
3. Hədəf production Vercel layihəsi, bağlı domen, branch, veritabanı, migrasiya siyasəti və məsul administrator yazılı qeyd edilib; Preview secret-i production-a kopyalanmır.
4. Real production bazası üçün **ayrıca** yedəkləmə hazırlanıb, müstəqil disposable bərpa üzərində doğrulanıb, yazma fasiləsi/migrasiya pəncərəsi razılaşdırılıb. CI-də disposable DB backup/restore bunun əvəzi deyil.
5. Migrasiya siyahısı tətbiq sahibi tərəfindən nəzərdən keçirilib; geriyə uyğun və məlumat itirməyən keçid planı təsdiqlənib. Əgər legacy otel məlumatı varsa, `stayKey`/folio üçün uzlaşdırma və backfill planı lazımdır.
6. Otel funksiyaları production-da **deaktiv vəziyyətdə** kod inteqrasiyası və deploy yoxlamasından keçir; sonra ayrıca icazə ilə tədricən aktivləşdirilir. Restoran sifariş rejimi dəyişdirilmir.
7. PMS və kart ödənişi provayder/kontrakt/webhook yoxlamaları bitməyibsə **bağlı qalır**; `PENDING → APPROVED` daxili otaq hesabı bankda faktiki pul alınması demək deyil.
8. Əvvəlki işlək deployment və konkret geri qaytarma addımları qeydə alınıb; monitorinq, error log və biznes yoxlama sahibləri təyin edilib.
9. **Ayrıca və açıq production release razılığı** qəbul protokolunda göstərilib.

## 5. Buraxılışın ardıcıllığı (ancaq təsdiqdən sonra)

1. GitHub `main` ilə otel feature branch arasındakı fərqləri analiz et; inteqrasiya PR-ı üzərində restoran və otel sınaqlarını yenidən keçir. Uğurlu Preview commit-ini birbaşa production kimi promote etmə; production environment ilə **ayrıca build** tələb olunur.
2. Hədəf production database və Vercel environment dəyişənlərinin **adlarını və target-lərini** yoxla; gizli dəyərləri loga çıxarma.
3. Yazılı təsdiqdən sonra əvvəlcə full backup al, bərpasını ayrıca DB-də sına; migrasiyaları yalnız dəqiq hədəf DB-ə tətbiq et və uyğunsuzluqları dayandır.
4. Production build-i domeni yönləndirmədən ayrıca mərhələdə yerləşdir və smoke/sifariş/tenant testləri et.
5. Yalnız yekun operator razılığı ilə trafik və otel aktivləşdirməsini addım-addım həyata keçir.
6. İlk canlı istifadədə 403/500 cavabları, auth problemləri, sifarişin doğru otelə düşməsi, bildiriş və checkout hesabatlarını monitorinq et.

## 6. Təcili geri qaytarma

- Birinci qoruyucu addım: otel funksiyasını **yalnız təsdiqlənmiş hədəf mühitdə** deaktiv etmək, real istifadəçilər üçün yeni otel əməliyyatlarını dayandırmaq. Restoran sisteminin rejiminə toxunma.
- İkinci addım: son məlum stabil **production** build-ə rollback; köhnə Preview deployunu production-a yanlışlıqla promote etmə.
- Verilənlər bazası geri qaytarılması avtomatik deyil: yeni otel sifarişləri yazılıbsa, köhnə backup-u kor-koranə bərpa etmək məlumat itkisinə səbəb ola bilər. Uyğunluq və data-reconciliation planı ilə bərpa qərarı ver.
- Nasazlıq müddəti, təsir olunan tenant-lar, təsdiqlər, geri dönüş və son yoxlama nəticəsi Issue #2-yə qeyd olunsun.

## 7. Qərar

- **Automation:** PASS (mobil Chromium/WebKit emulyasiyası və disposable DB testləri).
- **Real cihaz/operator:** PENDING (manual M01–M12).
- **Gerçək production DB backup / release approval:** PENDING.
- **Production:** **NO-GO**, ayrıca razılıq və sübut olmadan deploy/merge/promotion icra edilməməlidir.
