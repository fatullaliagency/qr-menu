import test from "node:test";
import assert from "node:assert/strict";
import {parseHotelFolioDateRange,hotelFolioCsv,hotelFolioCsvCell} from "../app/lib/hotel-folio-export.ts";

test("UTC date range defaults to 30 days, rejects invalid values and >31 days",()=>{
 const now=new Date("2026-11-13T16:00:00Z");
 const def=parseHotelFolioDateRange(null,null,now);
 assert.equal(def.start.toISOString(),"2026-10-15T00:00:00.000Z");
 assert.equal(def.endExclusive.toISOString(),"2026-11-14T00:00:00.000Z");
 const one=parseHotelFolioDateRange("2026-11-13","2026-11-13",now);
 assert.equal(one.endExclusive.toISOString(),"2026-11-14T00:00:00.000Z");
 assert.equal(parseHotelFolioDateRange("2026-02-30","2026-03-02",now),null);
 assert.equal(parseHotelFolioDateRange("2026-10-01","2026-11-13",now),null);
 assert.equal(parseHotelFolioDateRange("2026-11-14","2026-11-13",now),null);
 assert.equal(parseHotelFolioDateRange(["2026-11-13"],null,now),null);
});
test("Excel-compatible CSV uses separate Azerbaijani columns, date labels and injection protection",()=>{
 assert.equal(hotelFolioCsvCell('=HYPERLINK("evil")'),"\"'=HYPERLINK(\"\"evil\"\")\"");
 assert.equal(hotelFolioCsvCell("  +1"),"\"'  +1\"");
 assert.equal(hotelFolioCsvCell('Otel "Bakı"'),"\"Otel \"\"Bakı\"\"\"");
 assert.equal(hotelFolioCsvCell("Bakı;Mərkəz"),'"Bakı;Mərkəz"');
 const csv=hotelFolioCsv([{
  hotel:"Otel Bakı",room:"101",stay:"abc",orderId:"order1",
  department:"KITCHEN",orderStatus:"COMPLETED",chargeStatus:"APPROVED",amount:"13.00",
  createdAt:"2026-11-13T00:00:00.000Z",approvedAt:"2026-11-13T00:05:00.000Z"
 }]);
 assert.ok(csv.startsWith("\uFEFFsep=;\r\n"));
 assert.match(csv,/"Otelin adı";"Otaq №";"Şöbə"/);
 assert.match(csv,/"Otel Bakı";"101";"Mətbəx \/ restoran";"Tamamlandı";"Daxili təsdiq";"13,00";"13\.11\.2026 04:00";"13\.11\.2026 04:05";"order1";"abc"/);
 assert.equal(csv.split("\r\n").filter(Boolean).length,3); // separator directive + headings + one row
});
