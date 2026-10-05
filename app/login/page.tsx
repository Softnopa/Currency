import { LangToggle } from "@/components/LangToggle";
import { getT } from "@/lib/i18n-server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const t = await getT();

  return (
    <div className="mx-auto mt-6 max-w-sm sm:mt-16">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold text-primary">
          <span aria-hidden>🍎</span>
          {t.appName}
        </h1>
        <LangToggle />
      </div>
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold">{t.loginTitle}</h2>
        <LoginForm />
      </div>
    </div>
  );
}
