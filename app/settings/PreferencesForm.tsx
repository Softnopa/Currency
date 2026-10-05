"use client";

import { useState, useTransition } from "react";
import { savePrefs, setLang } from "@/app/actions";
import { useT } from "@/components/LangProvider";
import { Segmented } from "@/components/Segmented";
import { CURRENCIES } from "@/lib/calc";
import type { Lang } from "@/lib/i18n";
import {
  applyPrefsToDocument,
  FONT_SIZES,
  MODES,
  THEME_COLORS,
  type FontSize,
  type Prefs,
  type ThemeColor,
} from "@/lib/prefs";

export function PreferencesForm({ initial }: { initial: Prefs }) {
  const { t, lang } = useT();
  const [prefs, setPrefs] = useState(initial);
  const [, startTransition] = useTransition();

  function update(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    applyPrefsToDocument(next);
    startTransition(() => savePrefs(patch));
  }

  return (
    <>
      <section className="card space-y-5">
        <h2 className="text-lg font-semibold">{t.appearance}</h2>

        <div>
          <span className="label">{t.themeColor}</span>
          <div role="radiogroup" aria-label={t.themeColor} className="flex flex-wrap gap-3">
            {(Object.keys(THEME_COLORS) as ThemeColor[]).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={prefs.color === c}
                aria-label={c}
                onClick={() => update({ color: c })}
                style={{ background: THEME_COLORS[c].light }}
                className={`size-11 rounded-full ring-offset-2 ring-offset-surface transition ${
                  prefs.color === c ? "ring-3 ring-foreground" : "hover:scale-105"
                }`}
              >
                {prefs.color === c && <span className="text-lg font-bold text-white">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">{t.mode}</span>
          <Segmented
            label={t.mode}
            value={prefs.mode}
            onChange={(mode) => update({ mode })}
            options={MODES.map((m) => ({
              value: m,
              label: `${m === "light" ? "☀️" : m === "dark" ? "🌙" : "📱"} ${t.modes[m]}`,
            }))}
          />
        </div>

        <div>
          <span className="label">{t.fontSize}</span>
          <Segmented
            label={t.fontSize}
            value={prefs.fontSize}
            onChange={(fontSize) => update({ fontSize })}
            options={(Object.keys(FONT_SIZES) as FontSize[]).map((s) => ({
              value: s,
              label: <span style={{ fontSize: `${FONT_SIZES[s] / 16}em` }}>{t.fontSizes[s]}</span>,
            }))}
          />
          <p className="mt-3 rounded-xl bg-primary-soft px-3 py-2.5 font-semibold text-primary">{t.fontPreview}</p>
        </div>

        <div>
          <span className="label">{t.language}</span>
          <Segmented<Lang>
            label={t.language}
            value={lang}
            onChange={(l) => startTransition(() => setLang(l))}
            options={[
              { value: "latn", label: "O'zbekcha (Lotin)" },
              { value: "cyrl", label: "Ўзбекча (Кирилл)" },
            ]}
          />
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">{t.defaults}</h2>
        <span className="label">{t.defaultExpenseCurrency}</span>
        <Segmented
          label={t.defaultExpenseCurrency}
          value={prefs.expenseCurrency}
          onChange={(expenseCurrency) => update({ expenseCurrency })}
          options={CURRENCIES.map((c) => ({ value: c, label: t.currencyNames[c] }))}
        />
        <p className="text-sm text-muted">{t.defaultExpenseCurrencyHint}</p>
      </section>
    </>
  );
}
