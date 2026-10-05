"use client";

import { createContext, use } from "react";
import { dictionaries, type Lang, type Messages } from "@/lib/i18n";

const LangContext = createContext<{ lang: Lang; t: Messages }>({
  lang: "latn",
  t: dictionaries.latn,
});

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext value={{ lang, t: dictionaries[lang] }}>{children}</LangContext>;
}

export function useT() {
  return use(LangContext);
}
