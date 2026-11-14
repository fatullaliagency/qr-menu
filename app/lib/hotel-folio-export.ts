const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseHotelFolioDateRange(
  from: unknown, to: unknown, now: Date = new Date()
): { start: Date; endExclusive: Date } | null {
  if ((from !== null && from !== undefined && typeof from !== "string") ||
      (to !== null && to !== undefined && typeof to !== "string")) return null;
  function midnight(value: string): Date | null {
    if (!ISO_DAY.test(value)) return null;
    const day = new Date(value + "T00:00:00.000Z");
    return Number.isFinite(day.getTime()) && day.toISOString().slice(0,10) === value ? day : null;
  }
  const defaultEnd = Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1);
  const endDay = to ? midnight(to) : new Date(defaultEnd-DAY_MS);
  const startDay = from ? midnight(from) : new Date(defaultEnd-30*DAY_MS);
  if(!endDay || !startDay) return null;
  const endExclusive = new Date(endDay.getTime()+DAY_MS);
  const days = (endExclusive.getTime()-startDay.getTime())/DAY_MS;
  if(days<1 || days>31 || !Number.isInteger(days)) return null;
  return {start:startDay,endExclusive};
}

export type HotelFolioCsvRow = {
  hotel: string; room: string; stay: string; orderId: string;
  department: string; orderStatus: string; chargeStatus: string;
  amount: string; createdAt: string; approvedAt: string;
};

/** Excel-friendly output for the Azerbaijan/Russian locale (semicolon fields,
 * decimal comma, UTF-8 BOM). The sep directive lets Excel open columns correctly
 * when the user's Windows list separator differs from the CSV delimiter.
 * This is a CSV file, not a native XLSX workbook.
 */
const DEPARTMENT_LABELS: Record<string, string> = {
 KITCHEN:"Mətbəx / restoran",
 HOUSEKEEPING:"Otaq xidməti / təmizlik",
 RECEPTION:"Resepsiyon",
 TRANSFER:"Transfer",
 SPA:"SPA",
};
const ORDER_STATUS_LABELS: Record<string, string> = {
 NEW:"Yeni",
 ACCEPTED:"Qəbul edildi",
 PREPARING:"Hazırlanır",
 DISPATCHED:"Göndərildi",
 COMPLETED:"Tamamlandı",
};
const CHARGE_STATUS_LABELS: Record<string, string> = {
 PENDING:"Gözləyir",
 APPROVED:"Daxili təsdiq",
 VOID:"Ləğv edildi",
};
const bakuFormatter = new Intl.DateTimeFormat("en-GB", {
 timeZone:"Asia/Baku",year:"numeric",month:"2-digit",day:"2-digit",
 hour:"2-digit",minute:"2-digit",hour12:false,
});
export function hotelFolioBakuDate(value: string): string {
 if(!value)return "";
 const date = new Date(value);
 if(Number.isNaN(date.getTime()))return value;
 const parts = Object.fromEntries(bakuFormatter.formatToParts(date).map(p=>[p.type,p.value]));
 return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

/** Quote every CSV cell and defend against formula injection in spreadsheet apps. */
export function hotelFolioCsvCell(value: string): string {
 const safe = /^[\\s\\u0000-\\u001f]*[=+@-]/.test(value) ? "'" + value : value;
 return '"' + safe.replaceAll('"','""') + '"';
}
export function hotelFolioCsv(rows: HotelFolioCsvRow[]): string {
 const header = ["Otelin adı","Otaq №","Şöbə","Sifarişin vəziyyəti",
  "Otaq hesabının vəziyyəti","Məbləğ (AZN)","Yaradılma tarixi (Bakı)",
  "Təsdiq tarixi (Bakı)","Sifariş ID","Qalma dövrü kodu"];
 const lines = [header,...rows.map(r=>[
  r.hotel,r.room,DEPARTMENT_LABELS[r.department]??r.department,
  ORDER_STATUS_LABELS[r.orderStatus]??r.orderStatus,
  CHARGE_STATUS_LABELS[r.chargeStatus]??r.chargeStatus,
  r.amount.replace(".",","),
  hotelFolioBakuDate(r.createdAt),hotelFolioBakuDate(r.approvedAt),
  r.orderId,r.stay,
 ])];
 return "\uFEFFsep=;\r\n" +
  lines.map(row=>row.map(hotelFolioCsvCell).join(";")).join("\r\n") + "\r\n";
}
