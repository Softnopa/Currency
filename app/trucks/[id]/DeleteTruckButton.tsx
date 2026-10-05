"use client";

import { useTransition } from "react";
import { deleteTruck } from "@/app/actions";
import { useT } from "@/components/LangProvider";

export function DeleteTruckButton({ id }: { id: string }) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(t.confirmDelete)) return;
        startTransition(async () => {
          // On success the action redirects to the history page.
          const res = await deleteTruck(id);
          if (!res.ok) alert(t.errSave);
        });
      }}
      className="btn-ghost border-danger/30 text-danger hover:bg-danger-soft"
    >
      {pending ? "..." : t.deleteTruck}
    </button>
  );
}
