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

/** RFC4180 quoting and defense against spreadsheet formula injection. */
export function hotelFolioCsvCell(value: string): string {
 const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? "'" + value : value;
 return '"' + safe.replaceAll('"','""') + '"';
}
export function hotelFolioCsv(rows: HotelFolioCsvRow[]): string {
 const header = ["Hotel","Room","Stay ID","Order ID","Department","Order status",
   "Room charge status","Amount AZN","Created UTC","Approved UTC"];
 const lines = [header, ...rows.map(r=>[
  r.hotel,r.room,r.stay,r.orderId,r.department,r.orderStatus,r.chargeStatus,
  r.amount,r.createdAt,r.approvedAt
 ])];
 return "\uFEFF" + lines.map(r=>r.map(hotelFolioCsvCell).join(",")).join("\r\n") + "\r\n";
}
