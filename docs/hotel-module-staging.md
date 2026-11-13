# Otel modulu – platforma genişləndirmə texniki tapşırığı

Bu dəyişiklik `feature/hotel-module-v1` filialında hazırlanır və
`Restaurant`, `Order`, `Category` və mövcud restoran marşrutlarını dəyişmir.

## Testə keçid şərtləri
1. Yalnız ayrıca otel CI verilənlər bazasında `prisma migrate deploy` işlədin; production DB-yə bu migrasiyanı tətbiq etməyin.
2. `ENABLE_HOTEL_MODULE=true` yalnız otel test layihəsi/mühitində təyin edilməlidir; bağlı olarsa otel səhifələri və superadmin otel DB oxunuşları deaktivdir.
3. `ADMIN_SESSION_SECRET` ən az 32 simvollu olmalıdır; otel QR HMAC və otel admin sessiyaları həmin açardan domen ayrılığı ilə istifadə edir.
4. Superadmin yalnız `ENABLE_SUPERADMIN_PANEL=true` və `SUPERADMIN_ACCESS_KEY` tənzimlənəndə işləyir.
5. CI bütün köhnə restoran testlərini, yeni otel testlərini, PostgreSQL izolyasiyasını, TypeScript-i və build-i yoxlamalıdır.

## V1 test marşrutları
- `/superadmin/new`: yeni restoran və ya otel tipi.
- `/superadmin/hotels/new`: otel adı, filial, kontakt, 1–500 otaq, bölmələr, PİN.
- `/hotel-admin`: ayrıca otel admin giriş.
- `/hotel-admin/panel/kitchen`, `/hotel-admin/panel/housekeeping`, `/hotel-admin/panel/reception`.
- `/hotel/<otel-slug>/room/<otaq-nomresi>?t=<qr-token>`: yalnız uyğun QR və dolu otaq.
- `/hotel/<otel-slug>/track/<request-id>?t=<tracking-token>`: qonağın sifariş izləmə linki.

## Təhlükəsizlik qərarları
- Şöbələrə yönləndirmə serverdə xidmət kateqoriyasından müəyyən edilir.
- Çatdırılan bütün məlumatlar hotelId ilə süzgəcdən keçirilir; restoranın PİN sessiyası otel panelində qəbul olunmur.
- Eyni səbət müxtəlif şöbələrə ayrı sifarişlər kimi yazılır, amma bir izləmə linki verilir.
- `clientRequestId` UNIQUE-dur: eyni əməliyyat təkrarlanarsa ikinci dəfə sifariş yaradılmır.
- Otağın statusu VACANT ediləndə QR nonce dəyişir; əvvəlki QR artıq işləməyəcək.
- QR kodlarındakı token texniki giriş məlumatıdır; QR kodun fiziki və ya rəqəmsal surətini üçüncü tərəf ələ keçirə bilər. QR PNG-si yalnız adminin brauzerində qrcode paketi ilə yaradılır; QR URL xarici QR servisə göndərilmir.
- QR-dən göndərilən ödənişli müraciət **yalnız daxili otaq hesabına yazılma üçün gözləyən qeyd** sayılır; bankdan pul tutulmur, otelin PMS billing sisteminə avtomatik post edilmir.
- Menecer /hotel-admin vasitəsilə fərdi otel əməkdaşlarını yaradır, söndürür və PİN-i sıfırlayır. Əməkdaş /hotel-staff ilə yalnız təyin edilmiş şöbə panelinə daxil olur; başqa şöbənin API-si 403 qaytarır. Deaktiv edilmə və PİN sıfırlanması mövcud sessiyanı etibarsız edir. Menecer PİN-ini əməkdaşlarla paylaşmayın.
- Otel otağı QR kodları brauzerdə lokal yaradılır; restoranın mövcud QR yaratma koduna toxunulmur.

## Qəbul testləri
- Hər iki tip üçün superadmin yaratma və filtr.
- Eyni nömrəli iki otel otağının fərqli QR tokeni, rotasiyadan sonra əvvəlki tokenin rədd edilməsi.
- DOLU/BOŞ vəziyyətlərinə görə qonaq sifarişinin yoxlanılması.
- 3 kateqoriyanın ayrı şöbələrə yönləndirilməsi və eyni səbətin izləmə linki.
- 5 status üzrə hadisə tarixçəsi, səsli/visal bildiriş, qonağın poll vasitəsilə status yenilənməsi.
- İki otel arasında ID izolyasiyası; restoran testlərinin dəyişməməsi.

## Staff RBAC CI
- HotelStaff modeli ayrıca hotelId üzərində unique username və şöbə icazəsi saxlayır.
- CI-də fərdi əməkdaş login, başqa şöbə rəddi, menecer UI rəddi və deaktivasiya yoxlanılır.
- DB migrasiyası yalnız disposable `qr_hotel_ci` üzərində avtomatik işlədilir; real otel/PMS mühitinə tətbiq edilməyib.

## Otaq hesablaşması — daxili ledger, POS/PMS deyil
- Hər yeni HotelOrder ilə eyni tranzaksiyada bir HotelRoomCharge PENDING yaradılır (orderId UNIQUE), bütün status dəyişmələri HotelRoomChargeEvent-a yazılır.
- Yalnız menecer /hotel-admin/billing vasitəsilə COMPLETED sifariş üçün APPROVED (daxili təsdiq) edə bilər; PENDING qeydi VOID etmək mümkündür.
- Qiymət serverdə müəyyən edilir; digər otelin ID-si və əməkdaş sessiyası ilə otaq hesabına müdaxilə qadağandır.
- APPROVED pulun ödənildiyini göstərmir. Xarici PMS/ödəmə API-ləri və real məxaric/ödəniş təsdiqləri hələ yoxdur.
- Mövcud köhnə otel sifarişləri üçün avtomatik ledger backfill edilməyib; miqrasiya öncəsi ayrıca inventar/reconciliation lazımdır.
- Superadmin otellərin daxili təsdiqli hesab məbləğini restoranın PAID gəlirindən ayrıca göstərir.

## Qonaq status bildirişləri və idempotent retry
- Eyni requestId yenidən göndəriləndə orijinal otel/otaq, bütün xidmət və saylar, qonaq qeydi uyğun olmalıdır; fərqli məzmun eyni izləmə linkini aça bilməz.
- UUIDv4 formatı təsdiqlənir; PostgreSQL UNIQUE paralel təkrar yaradılmasını bloklayır.
- Qonaq izləmə səhifəsində status hər 12 saniyədə yenilənir; istifadəçinin açıq razılığı olarsa brauzer Notification göstərir. Brauzer bağlı olanda push yoxdur, fiziki cihaz testi hələ aparılmayıb.

- Eyni brauzerdə əməkdaş girişi menecer sessiyasını, menecer girişi isə əməkdaş sessiyasını ləğv edir. 401/403 bildiriş cavabından sonra şöbə ekranında yenidən giriş tələb olunur.

## Qalma dövrü və əməliyyatların çıxarışı
- Yeni otaq hesabı `stayKey` ilə otaq nömrəsi təkrar istifadə edildikdə fərqli qonaq qalma dövrlərinə ayrılır.
- OCCUPIED otaq VACANT və ya OUT_OF_SERVICE statusuna keçəndə QR nonce yenilənir; yeni qonağa yenidən QR verilməlidir.
- Əvvəlki hesablar `legacy` kimi işarələnir və avtomatik müəyyən qonağa bağlanmır.
- Menecer `/hotel-admin/billing/export` üzərindən 31 günlük dövr üçün maksimum 5000 daxili hesab qeydini CSV kimi endirə bilər. Digər otelin məlumatları və qonaq PII-si ixrac edilmir.
- CSV PMS-ə avtomatik inteqrasiya və ya bank ödənişinin təsdiqi deyil; məlumatı otelin daxili uçotuna uyğun əl ilə üzləşdirmək lazımdır.
