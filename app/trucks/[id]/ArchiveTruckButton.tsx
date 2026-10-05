"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTrucksArchived } from "@/app/actions";
import { useT } from "@/components/LangProvider";

export function ArchiveTruckButton({ id, archived }: { id: string; archived: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await setTrucksArchived([id], !archived);
          if (!res.ok) return alert(t.errGeneric);
          router.push(archived ? "/trucks" : "/trucks?archive=1");
        })
      }
      className="btn-ghost"
    >
      {pending ? "..." : archived ? `↩️ ${t.unarchiveTruck}` : `📦 ${t.archiveTruck}`}
    </button>
  );
}
