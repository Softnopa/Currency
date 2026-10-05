"use client";

import { useTransition } from "react";
import { setLang } from "@/app/actions";
import { LANGS } from "@/lib/i18n";
import { useT } from "./LangProvider";

const LABELS = { latn: "Lotin", cyrl: "Кирилл" } as const;

export function LangToggle() {
  const { lang } = useT();
  const [pending, startTransition] = useTransition();

  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm" aria-busy={pending}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => startTransition(() => setLang(l))}
          className={`rounded-md px-2.5 py-1 font-medium transition ${
            l === lang ? "bg-primary text-on-primary" : "text-muted hover:text-foreground"
          }`}
          aria-pressed={l === lang}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
