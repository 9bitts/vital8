"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { readOfflineStore } from "@/lib/offline/store.client";
import { syncWhenOnline, addToQueue } from "@/lib/offline/sync.client";
import { dismissConflict } from "@/lib/offline/sync.client";
import { MobileSkeleton } from "@/modules/mobile/components/mobile-skeleton";

export default function MobileAgendaPage() {
  const { data: session } = useSession();
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof readOfflineStore>> | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [startsAt, setStartsAt] = useState("");

  async function load() {
    setSnapshot(await readOfflineStore());
  }

  useEffect(() => {
    void load();
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("novo")) {
      setShowForm(true);
    }
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    if (navigator.onLine) await syncWhenOnline();
    await load();
    setRefreshing(false);
  }

  async function createProvisional() {
    if (!session?.user?.id || !patientId || !startsAt) return;
    const firstAppt = snapshot?.snapshot?.appointments[0] as Record<string, unknown> | undefined;
    await addToQueue(
      "CREATE_PROVISIONAL_APPOINTMENT",
      {
        patientId,
        professionalId: firstAppt?.professionalId ?? "",
        serviceId: firstAppt?.serviceId ?? "",
        startsAt: new Date(startsAt).toISOString(),
        notes: "PROVISORIO_OFFLINE",
      },
      session.user.id,
    );
    setShowForm(false);
    await load();
  }

  if (!snapshot) return <MobileSkeleton rows={5} />;

  const appts = snapshot.snapshot?.appointments ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Próximas 2 semanas</h2>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={refreshing}
          className="min-h-11 text-sm text-blue-600 dark:text-blue-400"
        >
          {refreshing ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {snapshot.pendingConflicts.length > 0 && (
        <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <h3 className="text-sm font-medium">Pendências de sincronização</h3>
          {snapshot.pendingConflicts.map((c) => (
            <div key={c.id} className="text-sm">
              <p>{c.errorMessage}</p>
              <button
                type="button"
                className="mt-1 text-xs text-amber-800 underline dark:text-amber-200"
                onClick={() => void dismissConflict(c.id).then(load)}
              >
                Descartar
              </button>
            </div>
          ))}
        </section>
      )}

      {showForm && (
        <section className="space-y-2 rounded-lg border p-3 dark:border-zinc-800">
          <h3 className="text-sm font-medium">Agendamento provisório (offline)</h3>
          <input
            placeholder="ID do paciente"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="min-h-11 w-full rounded border px-3 dark:border-zinc-700"
          />
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="min-h-11 w-full rounded border px-3 dark:border-zinc-700"
          />
          <button
            type="button"
            onClick={() => void createProvisional()}
            className="min-h-11 w-full rounded-md bg-blue-600 text-sm text-white"
          >
            Enfileirar provisório
          </button>
        </section>
      )}

      <ul className="space-y-2">
        {appts.map((a) => (
          <li
            key={a.id as string}
            className="flex min-h-11 items-center justify-between rounded-lg border px-3 py-3 dark:border-zinc-800"
          >
            <div>
              <p className="font-medium">{a.patientName as string}</p>
              <p className="text-xs text-zinc-500">
                {new Date(a.startsAt as string).toLocaleString("pt-BR")}
                {a.offlineProvisional ? " · provisório" : ""}
              </p>
            </div>
            <span className="text-xs">{a.status as string}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="flex min-h-11 w-full items-center justify-center rounded-md bg-blue-600 text-sm font-medium text-white"
      >
        Novo agendamento
      </button>
    </div>
  );
}
