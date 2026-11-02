/**
 * Calendar dates are plain local calendar days ("YYYY-MM-DD"). They used to be
 * built with `date.toISOString().slice(0, 10)`, which converts local midnight
 * to UTC: east of Greenwich (France, Belgium…) that is 23:00 the day before, so
 * every cell, "today" and the day panel title were one day early.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day of a Date, as "YYYY-MM-DD". */
export function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of a "YYYY-MM-DD" day (new Date("YYYY-MM-DD") would be UTC midnight). */
export function parseLocalIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The 7 days of the week starting at `weekStart` (a local Monday). */
export function weekDays(weekStart: Date): { iso: string; date: Date }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    return { iso: localIso(date), date };
  });
}

/** Monday-first month grid cells: null for the leading/trailing blanks. */
export function monthCells(monthDate: Date): ({ iso: string; dayNum: number } | null)[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;
  return Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - leadingBlanks + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    return { iso: localIso(new Date(year, month, dayNum)), dayNum };
  });
}
