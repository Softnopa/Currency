import type { Currency } from "./calc";

const whole = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number, currency: Currency, somLabel: string): string {
  if (currency === "UZS") return `${whole.format(value)} ${somLabel}`;
  if (currency === "USD") return `$${cents.format(value)}`;
  return `¥${cents.format(value)}`;
}

export function formatCount(value: number): string {
  return whole.format(value);
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
