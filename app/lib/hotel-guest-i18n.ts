export const HOTEL_GUEST_LANGUAGES = ["az","en","ru"] as const;
export type HotelGuestLang = (typeof HOTEL_GUEST_LANGUAGES)[number];
export type HotelGuestCategory = "FOOD"|"ROOM_SERVICE"|"EXTRA"|"TRANSFER"|"SPA";
export type HotelGuestDepartment = "KITCHEN"|"HOUSEKEEPING"|"RECEPTION"|"TRANSFER"|"SPA";
export type HotelGuestOrderStatus = "NEW"|"ACCEPTED"|"PREPARING"|"DISPATCHED"|"COMPLETED";
/** The Central Bank of Azerbaijan last published 1 USD = 1.7000 AZN on 2026-11-13.
 * USD is indicative DISPLAY ONLY. The room ledger and bank obligations stay in AZN.
 * Update this value when the official rate changes; never take a payment in USD here. */
export const HOTEL_USD_AZN_DISPLAY_RATE=1.7;

export function hotelGuestLang(value:unknown):HotelGuestLang {
 return value==="en"||value==="ru"?value:"az";
}
export const hotelGuestText = {
 az:{
  label:"Azərbaycan",heading:"Otel · Qonaq xidmətləri",room:"Otaq №",
  inactive:"Otaq sifarişlər üçün aktiv deyil. Resepsiyona müraciət edin.",
  food:"Yemək və içki",roomService:"Otaq xidməti",extra:"Əlavə xidmətlər",transfer:"Transfer",spa:"SPA",
  empty:"Bu bölmədə xidmət yoxdur.",quantity:"Say",cart:"Səbət",emptyCart:"Xidmət seçilməyib.",
  total:"Cəmi",notes:"Qeyd (istəyə bağlı)",submit:"Otaq hesabına sifariş göndər",
  pending:"Sifariş qeydə alınır...",currencyNote:"Otelin daxili hesabı AZN ilə aparılır. Bank kartından avtomatik ödəniş tutulmur.",
  exchangeNote:"",originalPrice:"",notTranslated:"",
  tracking:"Sifariş izləmə",currentStatus:"Cari status",enableAlerts:"Status üçün brauzer bildirişini aktivləşdir",
  disableAlerts:"Brauzer bildirişini söndür",updated:"Sifarişinizin statusu yeniləndi.",
  notificationTitle:"Otel sifarişinin statusu yeniləndi",notificationBody:"Sifarişinizin vəziyyətini izləmə səhifəsində görə bilərsiniz.",
  unavailable:"Yenilənmə müvəqqəti əlçatan deyil. Səhifəni yeniləyə bilərsiniz.",
  alertsUnsupported:"Bu brauzerdə sistem bildirişi mövcud deyil.",
  alertsDenied:"Bildiriş icazəsi verilməyib.",alertsError:"Bildiriş icazəsi açıla bilmədi.",
  statusInfo:"Status hər 12 saniyədən bir yenilənir. Brauzer bağlı olanda push göndərilmir. Linki başqalarına göndərməyin.",
  chargeNote:"Otaq hesabına yazılmaq üçün otelin təsdiqini gözləyir.",
  status:{NEW:"Yeni",ACCEPTED:"Qəbul edildi",PREPARING:"Hazırlanır",DISPATCHED:"Göndərildi",COMPLETED:"Tamamlandı"},
  department:{KITCHEN:"Mətbəx / restoran",HOUSEKEEPING:"Otaq xidməti",RECEPTION:"Resepsiyon",TRANSFER:"Transfer xidməti",SPA:"SPA xidməti"},
 },
 en:{
  label:"English",heading:"Hotel · Guest services",room:"Room no.",
  inactive:"This room is not active for ordering. Please contact reception.",
  food:"Food & drinks",roomService:"Housekeeping",extra:"Additional services",transfer:"Transfers",spa:"Spa",
  empty:"No services available in this category.",quantity:"Qty",cart:"Your basket",emptyCart:"No services selected.",
  total:"Total (estimated)",notes:"Special instructions (optional)",submit:"Send order to room account",
  pending:"Sending your order...",currencyNote:"Your room account is recorded in Azerbaijani manat (AZN). No card or bank payment is taken online.",
  exchangeNote:"Estimated USD at 1 USD = 1.70 AZN. Display only; final room charges are in AZN.",
  originalPrice:"Amount in AZN:",notTranslated:"Service name shown in the hotel's original language.",
  tracking:"Track your order",currentStatus:"Current order status",enableAlerts:"Enable browser status notifications",
  disableAlerts:"Disable browser notifications",updated:"Your order status has changed.",
  notificationTitle:"Hotel order updated",notificationBody:"Open your tracking page to see the new status.",
  unavailable:"Updates are temporarily unavailable. You can refresh this page.",
  alertsUnsupported:"Browser notifications are not supported.",alertsDenied:"Notification permission was not granted.",
  alertsError:"Could not enable notifications.",
  statusInfo:"The status refreshes every 12 seconds. No push is sent while the browser is closed. Do not share this private link.",
  chargeNote:"Awaiting hotel confirmation to add this amount to your room account.",
  status:{NEW:"New",ACCEPTED:"Accepted",PREPARING:"Preparing",DISPATCHED:"On the way",COMPLETED:"Completed"},
  department:{KITCHEN:"Kitchen / restaurant",HOUSEKEEPING:"Housekeeping",RECEPTION:"Reception",TRANSFER:"Transfers",SPA:"Spa"},
 },
 ru:{
  label:"Русский",heading:"Отель · Услуги для гостей",room:"Номер",
  inactive:"Заказы для этого номера недоступны. Обратитесь на ресепшен.",
  food:"Еда и напитки",roomService:"Обслуживание номера",extra:"Дополнительные услуги",transfer:"Трансфер",spa:"СПА",
  empty:"В этом разделе пока нет услуг.",quantity:"Кол-во",cart:"Корзина",emptyCart:"Услуги не выбраны.",
  total:"Итого (приблизительно)",notes:"Примечание (необязательно)",submit:"Оформить заказ на счёт номера",
  pending:"Отправляем заказ...",currencyNote:"Счёт номера ведётся в азербайджанских манатах (AZN). С карты или банковского счёта оплата не списывается.",
  exchangeNote:"Приблизительная сумма в USD: 1 USD = 1,70 AZN. Только для информации; счёт ведётся в AZN.",
  originalPrice:"Сумма в AZN:",notTranslated:"Название услуги указано на языке отеля.",
  tracking:"Отслеживание заказа",currentStatus:"Статус заказа",enableAlerts:"Включить уведомления браузера",
  disableAlerts:"Отключить уведомления",updated:"Статус вашего заказа изменился.",
  notificationTitle:"Заказ в отеле обновлён",notificationBody:"Откройте страницу заказа, чтобы узнать новый статус.",
  unavailable:"Обновления временно недоступны. Обновите страницу.",
  alertsUnsupported:"Этот браузер не поддерживает уведомления.",alertsDenied:"Нет разрешения на уведомления.",
  alertsError:"Не удалось включить уведомления.",
  statusInfo:"Статус обновляется каждые 12 секунд. При закрытом браузере push-уведомления не отправляются. Не делитесь этой ссылкой.",
  chargeNote:"Ожидает подтверждения отеля для добавления в счёт номера.",
  status:{NEW:"Новый",ACCEPTED:"Принят",PREPARING:"Готовится",DISPATCHED:"Отправлен",COMPLETED:"Выполнен"},
  department:{KITCHEN:"Кухня / ресторан",HOUSEKEEPING:"Уборка номера",RECEPTION:"Ресепшен",TRANSFER:"Трансфер",SPA:"СПА"},
 }
} as const;
export function hotelGuestCategoryLabel(lang:HotelGuestLang,category:HotelGuestCategory):string {
 const labels={FOOD:"food",ROOM_SERVICE:"roomService",EXTRA:"extra",TRANSFER:"transfer",SPA:"spa"} as const;
 return hotelGuestText[lang][labels[category]];
}
export function hotelGuestPrice(amountAzn:number,lang:HotelGuestLang):string {
 if(!Number.isFinite(amountAzn)||amountAzn<0)throw new Error("Invalid service price");
 if(lang==="az")return amountAzn.toFixed(2)+" ₼";
 return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(amountAzn/HOTEL_USD_AZN_DISPLAY_RATE);
}
export function hotelGuestAznPrice(amountAzn:number):string{
 return amountAzn.toFixed(2)+" ₼";
}
export function hotelGuestServiceLabel(service:{
 name:string;nameEn?:string|null;nameRu?:string|null;
 description?:string|null;descriptionEn?:string|null;descriptionRu?:string|null
},lang:HotelGuestLang):{name:string;description:string|null;translated:boolean}{
 const targetName=lang==="en"?service.nameEn:lang==="ru"?service.nameRu:service.name;
 const targetDescription=lang==="en"?service.descriptionEn:lang==="ru"?service.descriptionRu:service.description;
 return {name:targetName?.trim()||service.name,
  description:targetDescription?.trim()||null,translated:lang==="az"||Boolean(targetName?.trim())};
}
export function hotelGuestTrackingUrl(slug:string,id:string,token:string,lang:HotelGuestLang):string{
 return "/hotel/"+encodeURIComponent(slug)+"/track/"+encodeURIComponent(id)+
 "?t="+encodeURIComponent(token)+"&lang="+encodeURIComponent(lang);
}
