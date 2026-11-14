import test from "node:test";
import assert from "node:assert/strict";
import {inflateRawSync} from "node:zlib";
import {hotelFolioXlsx} from "../app/lib/hotel-folio-xlsx.ts";

function entries(data){
 const files=new Map();let i=0;
 while(i+30<data.length && data.readUInt32LE(i)===0x04034b50){
  const method=data.readUInt16LE(i+8);
  const packed=data.readUInt32LE(i+18);
  const filenameSize=data.readUInt16LE(i+26);
  const extra=data.readUInt16LE(i+28);
  const name=data.subarray(i+30,i+30+filenameSize).toString("utf8");
  const start=i+30+filenameSize+extra;
  const raw=data.subarray(start,start+packed);
  files.set(name,(method===8?inflateRawSync(raw):raw).toString("utf8"));
  i=start+packed;
 }
 return files;
}
const data=[
 {hotel:"Dragon Hotel",room:"1",stay:"stay-one",orderId:"ord-food",
  department:"KITCHEN",orderStatus:"PREPARING",chargeStatus:"PENDING",
  amount:"30.00",createdAt:"2026-11-14T22:00:00.000Z",approvedAt:""},
 {hotel:"Dragon Hotel",room:"1",stay:"stay-one",orderId:"ord-spa",
  department:"SPA",orderStatus:"COMPLETED",chargeStatus:"APPROVED",
  amount:"40.00",createdAt:"2026-11-14T23:00:00.000Z",approvedAt:"2026-11-14T23:20:00.000Z"},
 {hotel:"Dragon Hotel",room:"1",stay:"stay-one",orderId:"ord-void",
  department:"TRANSFER",orderStatus:"NEW",chargeStatus:"VOID",
  amount:"10.00",createdAt:"2026-11-14T23:00:00.000Z",approvedAt:""}
];
test("native XLSX ZIP has two legible styled worksheets and numeric totals",()=>{
 const workbook=hotelFolioXlsx("Dragon Hotel",data,"2026-11-14","2026-11-15");
 assert.equal(workbook.readUInt32LE(0),0x04034b50);
 assert.ok(workbook.length>1500);
 const parts=entries(workbook);
 assert.equal(parts.size,7);
 const main=parts.get("xl/worksheets/sheet1.xml");
 const technical=parts.get("xl/worksheets/sheet2.xml");
 const styles=parts.get("xl/styles.xml");
 assert.ok(main&&technical&&styles);
 assert.match(parts.get("xl/workbook.xml"),/Otaq hesabatı/);
 assert.match(parts.get("xl/workbook.xml"),/Texniki qeydlər/);
 assert.match(main,/OTAQ XİDMƏTLƏRİ/);
 assert.match(main,/Mətbəx \/ restoran/);
 assert.match(main,/Daxili təsdiq/);
 assert.match(main,/Gözləyir/);
 assert.match(main,/Təsdiqlənib \(Bakı\)/);
 assert.match(main,/<f>SUM\(F9:F11\)<\/f><v>80<\/v>/);
 assert.match(main,/<f>SUMIF\(E9:E11,&quot;Daxili təsdiq&quot;,F9:F11\)<\/f><v>40<\/v>/);
 assert.match(main,/r="F9" s="9"><v>30<\/v>/);
 assert.match(main,/autoFilter ref="A8:H11"/);
 assert.match(main,/pane ySplit="8"/);
 assert.match(styles,/numFmtId="164"/);
 assert.match(styles,/FF137461/);
 assert.match(technical,/ord-food/);
 assert.match(technical,/stay-one/);
 assert.doesNotMatch(main,/ord-food/); // IDs not presented to hotel manager
});
test("XLSX escapes XML and protects spreadsheet from formula injection",()=>{
 const injected=hotelFolioXlsx('=HYPERLINK("bad") & <bad>',[{
  ...data[0],hotel:'=HYPERLINK("bad") & <bad>',room:"+12"
 }],"2026-11-14","2026-11-14");
 const parts=entries(injected);
 const main=parts.get("xl/worksheets/sheet1.xml");
 assert.match(main,/=HYPERLINK\(&quot;bad&quot;\) &amp; &lt;bad&gt;/);
 assert.match(main,/<c r="A9" s="7" t="inlineStr">/);
 assert.doesNotMatch(main,/<f>=HYPERLINK/);
 assert.match(main,/xml:space="preserve">\+12/);
});
test("XLSX rejects over-limit and invalid monetary values",()=>{
 assert.throws(()=>hotelFolioXlsx("Test",Array(5001).fill(data[0]),"2026-11-14","2026-11-14"));
 assert.throws(()=>hotelFolioXlsx("Test",[{...data[0],amount:"NaN"}],"2026-11-14","2026-11-14"));
});
