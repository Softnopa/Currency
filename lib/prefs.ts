import { CURRENCIES, type Currency } from "./calc";

export const PREFS_COOKIE = "prefs";

export const THEME_COLORS = {
  green: { light: "#1f6b3a", dark: "#4fb878" },
  blue: { light: "#1d4ed8", dark: "#7aa7ff" },
  teal: { light: "#0f766e", dark: "#2dd4bf" },
  purple: { light: "#6d28d9", dark: "#a78bfa" },
  orange: { light: "#c2410c", dark: "#fb8c4a" },
  rose: { light: "#be123c", dark: "#fb7185" },
} as const;
export type ThemeColor = keyof typeof THEME_COLORS;

export const MODES = ["light", "dark", "auto"] as const;
export type Mode = (typeof MODES)[number];

/** Root font size in px; every size in the app scales from it. */
export const FONT_SIZES = { s: 14, m: 16, l: 18, xl: 20 } as const;
export type FontSize = keyof typeof FONT_SIZES;

export type Prefs = {
  color: ThemeColor;
  mode: Mode;
  fontSize: FontSize;
  expenseCurrency: Currency;
};

export const DEFAULT_PREFS: Prefs = {
  color: "green",
  mode: "light",
  fontSize: "m",
  expenseCurrency: "USD",
};

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Validates whatever is in the cookie; unknown values fall back to defaults. */
export function parsePrefs(raw: unknown): Prefs {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {}
  } else if (raw && typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  }
  return {
    color: pick(obj.color, Object.keys(THEME_COLORS) as ThemeColor[], DEFAULT_PREFS.color),
    mode: pick(obj.mode, MODES, DEFAULT_PREFS.mode),
    fontSize: pick(obj.fontSize, Object.keys(FONT_SIZES) as FontSize[], DEFAULT_PREFS.fontSize),
    expenseCurrency: pick(obj.expenseCurrency, CURRENCIES, DEFAULT_PREFS.expenseCurrency),
  };
}

/** Inline style for <html>: font size and the chosen theme colour. */
export function prefsStyle(prefs: Prefs): Record<string, string> {
  const color = THEME_COLORS[prefs.color];
  return {
    fontSize: `${FONT_SIZES[prefs.fontSize]}px`,
    "--brand-light": color.light,
    "--brand-dark": color.dark,
  };
}

/** Applies preferences to the page instantly, before the server round-trip. */
export function applyPrefsToDocument(prefs: Prefs) {
  const root = document.documentElement;
  root.dataset.mode = prefs.mode;
  for (const [key, value] of Object.entries(prefsStyle(prefs))) {
    if (key.startsWith("--")) root.style.setProperty(key, value);
    else root.style.fontSize = value;
  }
}
