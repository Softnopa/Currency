import type { Currency } from "./calc";

const whole = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
// Like the Excel sheet: ¥218 731 and ¥127,42 — decimals only when there are any.
const upTo2 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

export function formatMoney(value: number, currency: Currency, somLabel: string): string {
  if (currency === "UZS") return `${whole.format(value)} ${somLabel}`;
  if (currency === "USD") return `$${upTo2.format(value)}`;
  return `¥${upTo2.format(value)}`;
}

export function formatCount(value: number): string {
  return whole.format(value);
}

/** Weights and other quantities: up to 2 decimals. */
export function formatAmount(value: number): string {
  return upTo2.format(value);
}

/** Rate shown in an input: enough precision to be exact, no float noise. */
export function rateToInput(value: number, decimals: number): string {
  return String(Math.round(value * 10 ** decimals) / 10 ** decimals);
}

/** Today's date in Tashkent as YYYY-MM-DD. */
export function todayInTashkent(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
}

/** YYYY-MM-DD → DD.MM.YYYY, the format used in Uzbekistan. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
