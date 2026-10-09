"use client";

import { useState, useTransition } from "react";
import { savePrefs, setLang } from "@/app/actions";
import { useT } from "@/components/LangProvider";
import { Segmented } from "@/components/Segmented";
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
    <section className="card space-y-5">
      <div>
        <h2 className="mb-3 text-lg font-semibold">🎨 {t.theme}</h2>
        <div role="radiogroup" aria-label={t.theme} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(THEME_COLORS) as ThemeColor[]).map((c) => {
            const color = THEME_COLORS[c].light;
            const selected = prefs.color === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update({ color: c })}
                className={`overflow-hidden rounded-xl border-2 bg-surface text-left transition ${
                  selected ? "border-foreground shadow-md" : "border-border hover:border-muted"
                }`}
              >
                <span className="block h-5" style={{ background: color }} />
                <span className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <span className="text-sm font-semibold">{t.themes[c]}</span>
                  <span
                    className="flex size-6 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: color }}
                  >
                    {selected ? "✓" : ""}
                  </span>
                </span>
              </button>
            );
          })}
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
  );
}
