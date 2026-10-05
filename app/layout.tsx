import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/Header";
import { LangProvider } from "@/components/LangProvider";
import { getLang, getPrefs } from "@/lib/i18n-server";
import { prefsStyle } from "@/lib/prefs";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Meva hisob-kitobi",
  description: "Yuk mashinasidagi mevalar narxini yuan, dollar va so'mda hisoblash",
};

export const viewport: Viewport = {
  themeColor: "#1f6b3a",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [lang, prefs] = await Promise.all([getLang(), getPrefs()]);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <html
      lang={lang === "cyrl" ? "uz-Cyrl" : "uz"}
      data-mode={prefs.mode}
      style={prefsStyle(prefs)}
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <LangProvider lang={lang}>
          {data?.claims && <Header />}
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 sm:py-8">{children}</main>
        </LangProvider>
      </body>
    </html>
  );
}
