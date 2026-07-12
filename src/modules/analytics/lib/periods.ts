export const SAO_PAULO_TZ = "America/Sao_Paulo";

/** Retorna YYYY-MM-DD do instante no fuso SP. */
export function toSpDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: SAO_PAULO_TZ });
}

/** Início/fim UTC do dia civil em São Paulo. */
export function spDayUtcBounds(dateKey: string): { start: Date; end: Date } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const startLocal = new Date(Date.UTC(y!, m! - 1, d!, 3, 0, 0, 0));
  const endLocal = new Date(Date.UTC(y!, m! - 1, d! + 1, 2, 59, 59, 999));
  return { start: startLocal, end: endLocal };
}

export function eachSpDateKey(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    keys.push(toSpDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return Array.from(new Set(keys));
}

export type PeriodRange = { from: Date; to: Date; label: string };

export function monthRange(year: number, month: number): PeriodRange {
  const from = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0));
  const to = new Date(Date.UTC(year, month, 0, 2, 59, 59, 999));
  return { from, to, label: `${month}/${year}` };
}

export function previousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

export function linearProjection(current: number, dayOfMonth: number, daysInMonth: number): number {
  if (dayOfMonth <= 0) return current;
  return Math.round((current / dayOfMonth) * daysInMonth);
}
