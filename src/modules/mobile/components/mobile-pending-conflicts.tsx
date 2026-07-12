"use client";

import { useEffect, useState } from "react";
import { dismissConflict, getPendingConflicts } from "@/lib/offline/sync.client";
import type { OfflineAction } from "@/lib/offline/types";

export function MobilePendingConflicts() {
  const [conflicts, setConflicts] = useState<OfflineAction[]>([]);

  async function load() {
    setConflicts(await getPendingConflicts());
  }

  useEffect(() => {
    void load();
  }, []);

  if (conflicts.length === 0) return null;

  return (
    <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
      <h3 className="text-sm font-medium">Pendências de sincronização</h3>
      {conflicts.map((c) => (
        <div key={c.id} className="text-sm">
          <p className="font-medium">{c.type}</p>
          <p className="text-amber-900 dark:text-amber-100">{c.errorMessage}</p>
          <button
            type="button"
            className="mt-1 min-h-11 text-xs text-amber-800 underline dark:text-amber-200"
            onClick={() => void dismissConflict(c.id).then(load)}
          >
            Descartar pendência
          </button>
        </div>
      ))}
    </section>
  );
}
