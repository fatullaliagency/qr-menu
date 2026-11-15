import test from "node:test";
import assert from "node:assert/strict";
import {
 hotelGuestLang,hotelGuestText,hotelGuestCategoryLabel,
 hotelGuestPrice,hotelGuestAznPrice,hotelGuestServiceLabel,
 hotelGuestTrackingUrl,HOTEL_USD_AZN_DISPLAY_RATE
} from "../app/lib/hotel-guest-i18n.ts";

test("Language input is allowlisted and always falls back to Azerbaijani",()=>{
 assert.equal(hotelGuestLang("en"),"en");
 assert.equal(hotelGuestLang("ru"),"ru");
 assert.equal(hotelGuestLang("az"),"az");
 for(const value of ["EN","de","<script>",null,undefined,{},["ru"]]){
  assert.equal(hotelGuestLang(value),"az");
 }
 assert.equal(hotelGuestText.en.submit,"Send order to room account");
 assert.equal(hotelGuestText.ru.cart,"Корзина");
 assert.equal(hotelGuestCategoryLabel("en","ROOM_SERVICE"),"Housekeeping");
 assert.equal(hotelGuestCategoryLabel("ru","TRANSFER"),"Трансфер");
});
test("Foreign-currency numbers are display-only USD, base AZN amounts remain unchanged",()=>{
 assert.equal(HOTEL_USD_AZN_DISPLAY_RATE,1.7);
 assert.equal(hotelGuestPrice(17,"en"),"$10.00");
 assert.equal(hotelGuestPrice(17,"ru"),"$10.00");
 assert.equal(hotelGuestPrice(17,"az"),"17.00 ₼");
 assert.equal(hotelGuestPrice(0,"en"),"$0.00");
 assert.equal(hotelGuestPrice(6.5,"en"),"$3.82");
 assert.equal(hotelGuestAznPrice(6.5),"6.50 ₼");
 assert.throws(()=>hotelGuestPrice(-10,"ru"));
 assert.match(hotelGuestText.en.exchangeNote,/Display only/);
 assert.match(hotelGuestText.ru.currencyNote,/AZN/);
});
test("Service translations use entered values only, never invent translations",()=>{
 const s={name:"Səhər yeməyi",description:"Otaq üçün",
  nameEn:"Breakfast",descriptionEn:"Breakfast served in your room",
  nameRu:"Завтрак",descriptionRu:"Завтрак в номер"};
 assert.deepEqual(hotelGuestServiceLabel(s,"en"),{
  name:"Breakfast",description:"Breakfast served in your room",translated:true
 });
 assert.deepEqual(hotelGuestServiceLabel(s,"ru"),{
  name:"Завтрак",description:"Завтрак в номер",translated:true
 });
 assert.equal(hotelGuestServiceLabel(s,"az").name,"Səhər yeməyi");
 const old=hotelGuestServiceLabel({name:"Əlavə dəsmal",description:"Dəsmal"},"en");
 assert.equal(old.name,"Əlavə dəsmal");
 assert.equal(old.translated,false);
 assert.equal(old.description,null);
});
test("Language follows token-bearing tracking link without changing token",()=>{
 const url=hotelGuestTrackingUrl("dragon-hotel","abc-123","secret+test","ru");
 assert.match(url,/\/hotel\/dragon-hotel\/track\/abc-123\?t=secret%2Btest&lang=ru$/);
});
