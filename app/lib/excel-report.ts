import "server-only";
import type { ReportRow } from "@/app/lib/superadmin-report";

// XLSX = ZIP konteynerində XML faylları. Əlavə npm asılılığı yoxdur.
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const value of data) {
    crc ^= value;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(files: { name: string; content: string }[]): Uint8Array {
  const chunks: Buffer[] = [];
  const directory: Buffer[] = [];
  let position = 0;
  let directorySize = 0;
  for (const file of files) {
    const filename = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.content, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30 + filename.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    filename.copy(local, 30);
    chunks.push(local, data);

    const central = Buffer.alloc(46 + filename.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(position, 42);
    filename.copy(central, 46);
    directory.push(central);
    directorySize += central.length;
    position += local.length + data.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(position, 16);
  return Buffer.concat([...chunks, ...directory, end]);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textCell(ref: string, value: string, style: number): string {
  return '<c r="' + ref + '" t="inlineStr" s="' + style +
    '"><is><t xml:space="preserve">' + escapeXml(value) + '</t></is></c>';
}

function numberCell(ref: string, value: number, style: number): string {
  if (!Number.isFinite(value)) throw new Error("Invalid report number");
  return '<c r="' + ref + '" s="' + style + '"><v>' + value + '</v></c>';
}

function excelDate(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) -
    Date.UTC(1899, 11, 30)) / 86400000);
}

const styles = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/></numFmts>',
  '<fonts count="3">',
  '<font><sz val="11"/><name val="Calibri"/></font>',
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
  '<font><b/><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/></font>',
  '</fonts>',
  '<fills count="4">',
  '<fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill>',
  '<fill><patternFill patternType="solid"><fgColor rgb="FF164E63"/><bgColor indexed="64"/></patternFill></fill>',
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F2F4"/><bgColor indexed="64"/></patternFill></fill>',
  '</fills>',
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
  '<cellXfs count="6">',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>',
  '<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
  '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>',
  '<xf numFmtId="2" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/>',
  '</cellXfs>',
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
  '</styleSheet>'
].join("");

export function buildDailyReportXlsx(
  rows: ReportRow[],
  totals: Pick<ReportRow, "orders" | "newOrders" | "paidOrders" | "paidCents">
): Uint8Array {
  const headings = [
    "Tarix", "Sifariş sayı", "Hazırda yeni",
    "Ödənişi təsdiqlənən", "Təsdiqlənmiş məbləğ (AZN)",
  ];
  const output: string[] = [];
  output.push('<row r="1" ht="34" customHeight="1">' +
    headings.map((text, index) =>
      textCell(String.fromCharCode(65 + index) + "1", text, 1)
    ).join("") + '</row>');

  for (const [index, row] of rows.entries()) {
    const n = index + 2;
    output.push('<row r="' + n + '">' +
      numberCell("A" + n, excelDate(row.day), 3) +
      numberCell("B" + n, row.orders, 0) +
      numberCell("C" + n, row.newOrders, 0) +
      numberCell("D" + n, row.paidOrders, 0) +
      numberCell("E" + n, row.paidCents / 100, 2) + '</row>');
  }
  const last = rows.length + 2;
  output.push('<row r="' + last + '" ht="25" customHeight="1">' +
    textCell("A" + last, "Cəmi", 4) +
    numberCell("B" + last, totals.orders, 4) +
    numberCell("C" + last, totals.newOrders, 4) +
    numberCell("D" + last, totals.paidOrders, 4) +
    numberCell("E" + last, totals.paidCents / 100, 5) + '</row>');

  const sheet = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<dimension ref="A1:E' + last + '"/>',
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>',
    '<sheetFormatPr defaultRowHeight="19"/>',
    '<cols>',
    '<col min="1" max="1" width="19" customWidth="1"/>',
    '<col min="2" max="2" width="19" customWidth="1"/>',
    '<col min="3" max="3" width="20" customWidth="1"/>',
    '<col min="4" max="4" width="27" customWidth="1"/>',
    '<col min="5" max="5" width="36" customWidth="1"/>',
    '</cols>',
    '<sheetData>' + output.join("") + '</sheetData>',
    '<autoFilter ref="A1:E' + (last - 1) + '"/>',
    '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>',
    '</worksheet>',
  ].join("");

  return makeZip([
    {
      name: "[Content_Types].xml",
      content: [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        '</Types>',
      ].join("")
    },
    {
      name: "_rels/.rels",
      content: [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
        '</Relationships>',
      ].join("")
    },
    {
      name: "xl/workbook.xml",
      content: [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        '<sheets><sheet name="Hesabat" sheetId="1" r:id="rId1"/></sheets></workbook>',
      ].join("")
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
        '</Relationships>',
      ].join("")
    },
    { name: "xl/styles.xml", content: styles },
    { name: "xl/worksheets/sheet1.xml", content: sheet },
  ]);
}
