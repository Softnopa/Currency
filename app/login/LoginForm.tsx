"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";
import { useT } from "@/components/LangProvider";

export function LoginForm() {
  const { t } = useT();
  const [state, formAction, pending] = useActionState(login, { error: false });

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">
          {t.email}
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          {t.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </div>
      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {t.loginError}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "..." : t.login}
      </button>
    </form>
  );
}
