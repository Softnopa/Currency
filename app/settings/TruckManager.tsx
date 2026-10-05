"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTrucks, setTrucksArchived } from "@/app/actions";
import { useT } from "@/components/LangProvider";
import { Segmented } from "@/components/Segmented";

export type ManagedTruck = {
  id: string;
  date: string;
  label: string;
  fruits: string;
  total: string;
  archived: boolean;
};

export function TruckManager({ trucks }: { trucks: ManagedTruck[] }) {
  const { t } = useT();
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const visible = trucks.filter((tr) => tr.archived === (tab === "archived"));
  const allSelected = visible.length > 0 && visible.every((tr) => selected.has(tr.id));
  const count = visible.filter((tr) => selected.has(tr.id)).length;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function run(action: (ids: string[]) => Promise<{ ok: boolean }>) {
    const ids = visible.filter((tr) => selected.has(tr.id)).map((tr) => tr.id);
    if (!ids.length) return;
    setError(false);
    startTransition(async () => {
      const res = await action(ids);
      if (!res.ok) return setError(true);
      setSelected(new Set());
      router.refresh();
    });
  }

  const countFor = (archived: boolean) => trucks.filter((tr) => tr.archived === archived).length;

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t.data}</h2>
        <p className="text-sm text-muted">{t.dataHint}</p>
      </div>

      <Segmented
        label={t.data}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setSelected(new Set());
        }}
        options={[
          { value: "active", label: `${t.active} (${countFor(false)})` },
          { value: "archived", label: `📦 ${t.archive} (${countFor(true)})` },
        ]}
      />

      {visible.length === 0 ? (
        <p className="py-4 text-center text-muted">{tab === "archived" ? t.noArchived : t.noTrucks}</p>
      ) : (
        <>
          <label className="flex items-center gap-3 px-1 text-sm font-medium">
            <input
              type="checkbox"
              className="size-5 accent-[var(--primary)]"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map((tr) => tr.id)))}
            />
            {t.selectAll}
          </label>

          <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {visible.map((tr) => (
              <li key={tr.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 px-3 py-3 transition ${
                    selected.has(tr.id) ? "bg-primary-soft" : "hover:bg-background"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-[var(--primary)]"
                    checked={selected.has(tr.id)}
                    onChange={() => toggle(tr.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium tabular-nums">
                      {tr.date}
                      {tr.label && <span className="font-normal text-muted"> · {tr.label}</span>}
                    </span>
                    <span className="block truncate text-sm text-muted">{tr.fruits}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{tr.total}</span>
                </label>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-sm text-muted">
              {t.selected}: <b className="text-foreground">{count}</b>
            </span>
            {tab === "active" ? (
              <button
                type="button"
                className="btn-ghost"
                disabled={!count || pending}
                onClick={() => run((ids) => setTrucksArchived(ids, true))}
              >
                📦 {t.archiveSelected}
              </button>
            ) : (
              <button
                type="button"
                className="btn-ghost"
                disabled={!count || pending}
                onClick={() => run((ids) => setTrucksArchived(ids, false))}
              >
                ↩️ {t.unarchiveSelected}
              </button>
            )}
            <button
              type="button"
              className="btn-ghost border-danger/30 text-danger hover:bg-danger-soft"
              disabled={!count || pending}
              onClick={() => {
                if (confirm(t.confirmDeleteMany)) run(deleteTrucks);
              }}
            >
              🗑 {t.deleteSelected}
            </button>
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {t.errGeneric}
            </p>
          )}
        </>
      )}

      <div className="border-t border-border pt-4">
        <a href="/api/export" download className="btn-ghost">
          📊 {t.exportExcel}
        </a>
        <p className="mt-2 text-sm text-muted">{t.exportHint}</p>
      </div>
    </section>
  );
}
