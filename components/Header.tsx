import Link from "next/link";
import { getT } from "@/lib/i18n-server";
import { LangToggle } from "./LangToggle";

export async function Header() {
  const t = await getT();
  const navLink = "rounded-lg px-3 py-1.5 hover:bg-primary-soft";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-primary">
          <span aria-hidden>🍎</span>
          {t.appName}
        </Link>
        <div className="ml-auto sm:hidden">
          <LangToggle />
        </div>
        <nav className="flex w-full items-center gap-1 text-sm font-medium sm:w-auto">
          <Link href="/" className={navLink}>
            {t.newTruck}
          </Link>
          <Link href="/trucks" className={navLink}>
            {t.history}
          </Link>
          <Link href="/settings" className={`${navLink} ml-auto sm:ml-0`}>
            <span aria-hidden>⚙️ </span>
            {t.settings}
          </Link>
        </nav>
        <div className="ml-auto hidden sm:block">
          <LangToggle />
        </div>
      </div>
    </header>
  );
}
