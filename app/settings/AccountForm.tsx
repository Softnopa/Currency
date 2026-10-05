"use client";

import { useActionState } from "react";
import { changePassword, logout } from "@/app/actions";
import { useT } from "@/components/LangProvider";

export function AccountForm({ email }: { email: string }) {
  const { t } = useT();
  const [state, formAction, pending] = useActionState(changePassword, { status: "idle" });

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t.account}</h2>
          <p className="text-sm text-muted">
            {t.loggedInAs}: <b className="text-foreground">{email}</b>
          </p>
        </div>
        <form action={logout}>
          <button type="submit" className="btn-ghost">
            {t.logout} →
          </button>
        </form>
      </div>

      <form action={formAction} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <div>
          <label htmlFor="password" className="label">
            {t.newPassword}
          </label>
          <input id="password" name="password" type="password" autoComplete="new-password" required className="field" />
        </div>
        <div>
          <label htmlFor="confirm" className="label">
            {t.confirmPassword}
          </label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="field" />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? t.saving : t.changePassword}
          </button>
          {state.status === "ok" && <span className="font-medium text-primary">{t.passwordChanged}</span>}
          {state.status === "error" && (
            <span role="alert" className="text-sm font-medium text-danger">
              {t[state.error]}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
