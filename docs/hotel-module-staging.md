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
- QR kodlarındakı token texniki giriş məlumatıdır; QR kodun fiziki və ya rəqəmsal surətini üçüncü tərəf ələ keçirə bilər.
- QR-dən göndərilən ödənişli müraciət **yalnız daxili otaq hesabına yazılma üçün gözləyən qeyd** sayılır; bankdan pul tutulmur, otelin PMS billing sisteminə avtomatik post edilmir.
- Panel mərhələsi otel admini üçündür. Fərdi əməkdaş hesabları və şöbə üzrə RBAC sonrakı mərhələdə tətbiq edilməlidir. Ümumi PİN-i bütün əməkdaşlara verməyin.
- Otaq QR şəkilləri mövcud restoran modulu kimi qrserver.com xidmətindən alınır: bu, QR URL-lərinin üçüncü tərəfə göndərilməsini nəzərdə tutur. Təhlükəsiz canlı istifadədən əvvəl yerli QR generatoru ilə əvəz edilməlidir.

## Qəbul testləri
- Hər iki tip üçün superadmin yaratma və filtr.
- Eyni nömrəli iki otel otağının fərqli QR tokeni, rotasiyadan sonra əvvəlki tokenin rədd edilməsi.
- DOLU/BOŞ vəziyyətlərinə görə qonaq sifarişinin yoxlanılması.
- 3 kateqoriyanın ayrı şöbələrə yönləndirilməsi və eyni səbətin izləmə linki.
- 5 status üzrə hadisə tarixçəsi, səsli/visal bildiriş, qonağın poll vasitəsilə status yenilənməsi.
- İki otel arasında ID izolyasiyası; restoran testlərinin dəyişməməsi.
