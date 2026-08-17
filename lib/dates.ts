const TAIPEI = "Asia/Taipei";

export function todayInTaipei(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function monthToDate(yearMonth: string): string {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error("計費月份格式需為 YYYY-MM");
  }
  return `${yearMonth}-01`;
}

export function dateToMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function formatMonthRange(start: string, end: string): string {
  const from = dateToMonth(start).replace("-", "/");
  const to = dateToMonth(end).replace("-", "/");
  return from === to ? from : `${from}–${to}`;
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("zh-TW").format(amount);
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${year}/${month}/${day}`;
}

export function daysUntil(dueDate: string, today = todayInTaipei()): number {
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  return Math.round((due - now) / 86_400_000);
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
