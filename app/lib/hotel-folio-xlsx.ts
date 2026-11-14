import { deflateRawSync } from "node:zlib";
import type { HotelFolioCsvRow } from "./hotel-folio-export";

/* Produces an actual OOXML Excel workbook, not delimiter-dependent CSV.
   Every user-controlled value is an inline string, never a formula. */
const dept: Record<string,string> = {
 KITCHEN:"Mətbəx / restoran", HOUSEKEEPING:"Təmizlik / otaq xidməti",
 RECEPTION:"Resepsiyon", TRANSFER:"Transfer", SPA:"SPA"
};
const order: Record<string,string> = {
 NEW:"Yeni", ACCEPTED:"Qəbul edildi", PREPARING:"Hazırlanır",
 DISPATCHED:"Göndərildi", COMPLETED:"Tamamlandı"
};
const charge: Record<string,string> = {
 PENDING:"Gözləyir", APPROVED:"Daxili təsdiq", VOID:"Ləğv edildi"
};
const xml = (v:string) => v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\uFFFE\uFFFF]/g,"")
 .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const S = (ref:string,text:string,style=0) => '<c r="'+ref+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xml(text)+'</t></is></c>';
const N = (ref:string,value:number,style=0) => {
 if(!Number.isFinite(value))throw new Error("Invalid numeric report data");
 return '<c r="'+ref+'" s="'+style+'"><v>'+value+'</v></c>';
};
const F = (ref:string,formula:string,value:number) =>
 '<c r="'+ref+'" s="4"><f>'+xml(formula)+'</f><v>'+value+'</v></c>';
const R = (n:number,cells:string[],height=23) =>
 '<row r="'+n+'" ht="'+height+'" customHeight="1">'+cells.join("")+'</row>';
const cityClock = new Intl.DateTimeFormat("en-GB",{
 timeZone:"Asia/Baku",hourCycle:"h23",year:"numeric",month:"2-digit",
 day:"2-digit",hour:"2-digit",minute:"2-digit"
});
const dateSerial = (raw:string) => {
 if(!raw)return null;
 const dt=new Date(raw);if(!Number.isFinite(dt.getTime()))return null;
 const p=Object.fromEntries(cityClock.formatToParts(dt).map(x=>[x.type,x.value]));
 return Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute))/86400000+25569;
};
const sum = (data:HotelFolioCsvRow[],status?:string) => data.reduce((n,r)=>{
 if(status&&r.chargeStatus!==status)return n;
 const cents=Math.round(Number(r.amount)*100);
 if(!Number.isSafeInteger(cents)||cents<0)throw new Error("Invalid folio amount");
 return n+cents;
},0)/100;

const fonts=[
 '<font><sz val="11"/><color rgb="FF223831"/><name val="Calibri"/></font>',
 '<font><b/><sz val="19"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
 '<font><sz val="10"/><color rgb="FFD5ECE5"/><name val="Calibri"/></font>',
 '<font><b/><sz val="10"/><color rgb="FF165848"/><name val="Calibri"/></font>',
 '<font><sz val="10"/><color rgb="FF8B5D17"/><name val="Calibri"/></font>',
 '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
].join("");
const fillColors=["FF073B31","FFE8F5F0","FF137461","FFF3F8F6","FFE3F4E7","FFFFF0C9","FFFFE5E5"];
const fills='<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+
 fillColors.map(c=>'<fill><patternFill patternType="solid"><fgColor rgb="'+c+'"/><bgColor indexed="64"/></patternFill></fill>').join("");
const xf=(font:number,fill:number,fmt=0) =>
 '<xf xfId="0" borderId="0" fontId="'+font+'" fillId="'+fill+'" numFmtId="'+fmt+'" applyFont="1" applyFill="1"'+
 (fmt?' applyNumberFormat="1"':'')+'/>';
const cellXfs=[
 xf(0,0),xf(1,2),xf(2,2),xf(3,3),xf(3,3,164),xf(4,7),
 xf(5,4),xf(0,0),xf(0,5),xf(0,0,164),xf(0,5,164),
 xf(0,0,165),xf(0,5,165),xf(3,6),xf(3,7),xf(3,8)
].join("");
const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
 '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;₼&quot;"/>'+
 '<numFmt numFmtId="165" formatCode="dd.mm.yyyy hh:mm"/></numFmts>'+
 '<fonts count="6">'+fonts+'</fonts><fills count="9">'+fills+'</fills>'+
 '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
 '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
 '<cellXfs count="16">'+cellXfs+'</cellXfs>'+
 '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

const cols = (widths:number[])=>widths.map((w,i)=>
 '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join("");
function mainSheet(hotel:string,data:HotelFolioCsvRow[],from:string,to:string):string{
 const last=Math.max(9,8+data.length);
 const lines=[
  R(1,[S("A1","OTAQ XİDMƏTLƏRİ — HESABAT",1)],37),
  R(2,[],9),
  R(3,[S("A3",hotel+"    |    "+from+" — "+to,2)],30),
  R(5,[
   S("A5","Ümumi qeydlər",3),F("B5","SUM(F9:F"+last+")",sum(data)),
   S("C5","Təsdiqlənib",3),F("D5",'SUMIF(E9:E'+last+',"Daxili təsdiq",F9:F'+last+')',sum(data,"APPROVED")),
   S("E5","Gözləyir",3),F("F5",'SUMIF(E9:E'+last+',"Gözləyir",F9:F'+last+')',sum(data,"PENDING")),
   S("G5","Ləğv edilib",3),F("H5",'SUMIF(E9:E'+last+',"Ləğv edildi",F9:F'+last+')',sum(data,"VOID"))
  ],30),
  R(7,[S("A7","Qeyd: Daxili hesab təsdiqi bank ödənişi demək deyil.",5)],27),
  R(8,["Otel","Otaq №","Xidmət şöbəsi","Sifarişin statusu",
   "Hesabın statusu","Məbləğ (AZN)","Yaradılıb (Bakı)","Təsdiqlənib (Bakı)"]
   .map((s,i)=>S(String.fromCharCode(65+i)+"8",s,6)),38)
 ];
 data.forEach((r,i)=>{
  const n=i+9,z=i%2?8:7,a=i%2?10:9,d=i%2?12:11;
  const aDate=dateSerial(r.createdAt),bDate=dateSerial(r.approvedAt);
  const statusStyle=r.chargeStatus==="APPROVED"?13:r.chargeStatus==="VOID"?15:14;
  lines.push(R(n,[
   S("A"+n,r.hotel,z),S("B"+n,r.room,z),
   S("C"+n,dept[r.department]??r.department,z),
   S("D"+n,order[r.orderStatus]??r.orderStatus,z),
   S("E"+n,charge[r.chargeStatus]??r.chargeStatus,statusStyle),
   N("F"+n,Number(r.amount),a),
   aDate===null?S("G"+n,"",z):N("G"+n,aDate,d),
   bDate===null?S("H"+n,"—",z):N("H"+n,bDate,d)
  ],27));
 });
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
 '<dimension ref="A1:H'+last+'"/>'+
 '<sheetViews><sheetView workbookViewId="0" showGridLines="0">'+
 '<pane ySplit="8" topLeftCell="A9" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
 '<sheetFormatPr defaultRowHeight="19"/><cols>'+cols([24,12,27,22,22,18,23,23])+'</cols>'+
 '<sheetData>'+lines.join("")+'</sheetData>'+
 '<mergeCells count="3"><mergeCell ref="A1:H2"/><mergeCell ref="A3:H3"/><mergeCell ref="A7:H7"/></mergeCells>'+
 '<autoFilter ref="A8:H'+last+'"/>'+
 '<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>'+
 '</worksheet>';
}
function detailSheet(data:HotelFolioCsvRow[]):string{
 const headers=["Otel","Otaq №","Sifariş ID","Qalma dövrünün kodu",
  "Şöbə","Sifariş statusu","Hesab statusu","Yaradılıb (UTC)","Təsdiqlənib (UTC)"];
 const lines=[
  R(1,[S("A1","TEXNİKİ QEYDLƏR — YOXLANIŞ ÜÇÜN",1)],37),R(2,[],9),
  R(3,headers.map((x,i)=>S(String.fromCharCode(65+i)+"3",x,6)),35)
 ];
 data.forEach((r,i)=>{
  const n=i+4,z=i%2?8:7;
  const values=[r.hotel,r.room,r.orderId,r.stay,r.department,r.orderStatus,r.chargeStatus,r.createdAt,r.approvedAt];
  lines.push(R(n,values.map((v,j)=>S(String.fromCharCode(65+j)+n,v,z)),25));
 });
 const last=Math.max(3,data.length+3);
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
 '<dimension ref="A1:I'+last+'"/>'+
 '<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
 '<sheetFormatPr defaultRowHeight="19"/><cols>'+cols([24,12,36,27,18,20,20,27,27])+'</cols>'+
 '<sheetData>'+lines.join("")+'</sheetData><mergeCells count="1"><mergeCell ref="A1:I2"/></mergeCells>'+
 '<autoFilter ref="A3:I'+last+'"/></worksheet>';
}
const crcTable=Array.from({length:256},(_,n)=>{
 let c=n;for(let i=0;i<8;i++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
 return c>>>0;
});
function crc32(data:Buffer):number{
 let c=0xffffffff;
 for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);
 return (c^0xffffffff)>>>0;
}
function zip(files:[string,string][]):Buffer{
 const localParts:Buffer[]=[],centralParts:Buffer[]=[];let offset=0;
 for(const [filename,content] of files){
  const name=Buffer.from(filename,"utf8"),raw=Buffer.from(content,"utf8");
  const packed=deflateRawSync(raw),checksum=crc32(raw);
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
  local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);
  local.writeUInt16LE(33,12);local.writeUInt32LE(checksum,14);
  local.writeUInt32LE(packed.length,18);local.writeUInt32LE(raw.length,22);
  local.writeUInt16LE(name.length,26);
  localParts.push(local,name,packed);
  const central=Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);
  central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);
  central.writeUInt16LE(8,10);central.writeUInt16LE(33,14);
  central.writeUInt32LE(checksum,16);central.writeUInt32LE(packed.length,20);
  central.writeUInt32LE(raw.length,24);central.writeUInt16LE(name.length,28);
  central.writeUInt32LE(offset,42);
  centralParts.push(central,name);
  offset+=local.length+name.length+packed.length;
 }
 const directory=Buffer.concat(centralParts);
 const end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);
 end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);
 end.writeUInt32LE(offset,16);
 return Buffer.concat([...localParts,directory,end]);
}
export function hotelFolioXlsx(hotel:string,data:HotelFolioCsvRow[],from:string,to:string):Buffer{
 if(data.length>5000)throw new Error("Folio export exceeds 5000 records");
 const files:[string,string][]=[
  ["[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
   '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
   '<Default Extension="xml" ContentType="application/xml"/>'+
   '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
   '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
   '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
   '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
   '</Types>'],
  ["_rels/.rels",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'+
   '</Relationships>'],
  ["xl/workbook.xml",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
   '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
   '<sheets><sheet name="Otaq hesabatı" sheetId="1" r:id="rId1"/>'+
   '<sheet name="Texniki qeydlər" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'],
  ["xl/_rels/workbook.xml.rels",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
   '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'+
   '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
  ["xl/styles.xml",styles],
  ["xl/worksheets/sheet1.xml",mainSheet(hotel,data,from,to)],
  ["xl/worksheets/sheet2.xml",detailSheet(data)]
 ];
 return zip(files);
}
