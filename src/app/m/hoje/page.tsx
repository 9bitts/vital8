"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import {
  callPatientAction,
  markNoShowAction,
} from "@/modules/scheduling/actions/reception.actions";
import { updateAppointmentStatusAction } from "@/modules/scheduling/actions/appointment.actions";
import { getMobileTodayAction } from "@/modules/mobile/actions/mobile.actions";
import { addToQueue } from "@/lib/offline/sync.client";
import { readOfflineStore } from "@/lib/offline/store.client";
import { MobileSkeleton } from "@/modules/mobile/components/mobile-skeleton";

type TodayData = Awaited<ReturnType<typeof getMobileTodayAction>>;
type QueueItem = TodayData["queue"][number];

function mapOfflineQueue(store: Awaited<ReturnType<typeof readOfflineStore>>): TodayData | null {
  if (!store.snapshot) return null;
  const today = new Date().toDateString();
  const appts = store.snapshot.appointments.filter(
    (a) => new Date(a.startsAt as string).toDateString() === today,
  );

  const toItem = (a: Record<string, unknown>): QueueItem =>
    ({
      id: a.id,
      status: a.status,
      startsAt: new Date(a.startsAt as string),
      endsAt: new Date(a.endsAt as string),
      updatedAt: new Date(a.updatedAt as string),
      arrivedAt: a.arrivedAt ? new Date(a.arrivedAt as string) : null,
      calledAt: a.calledAt ? new Date(a.calledAt as string) : null,
      patient: {
        id: a.patientId,
        fullName: a.patientName,
        socialName: null,
      },
      service: { name: a.serviceName },
      professional: { displayName: a.professionalName, color: "#3B82F6" },
      room: null,
      waitMinutes: 0,
    }) as QueueItem;

  return {
    queue: appts
      .filter((a) => ["AGUARDANDO", "EM_ATENDIMENTO"].includes(a.status as string))
      .map(toItem),
    upcoming: appts
      .filter((a) => ["AGENDADO", "CONFIRMADO"].includes(a.status as string))
      .map(toItem),
    noShows: appts.filter((a) => a.status === "FALTOU").map(toItem),
    finalized: appts.filter((a) => a.status === "FINALIZADO").map(toItem),
    waitingList: [],
    waitLimitMinutes: 30,
    orgSlug: "",
    canReception: true,
  };
}

export default function MobileHojePage() {
  const { data: session } = useSession();
  const [data, setData] = useState<TodayData | null>(null);
  const [offline, setOffline] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    if (!navigator.onLine) {
      setOffline(true);
      const store = await readOfflineStore();
      setData(mapOfflineQueue(store));
      return;
    }
    setOffline(false);
    const result = await getMobileTodayAction();
    setData(result);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 15000);
    return () => clearInterval(id);
  }, [load]);

  async function handleOfflineAction(
    type: "CONFIRM_APPOINTMENT" | "MARK_NO_SHOW" | "CALL_PATIENT",
    appointmentId: string,
    updatedAt?: string,
  ) {
    if (!session?.user?.id) return;
    if (!navigator.onLine) {
      await addToQueue(type, { appointmentId }, session.user.id, updatedAt ?? null);
      await load();
      return;
    }
    startTransition(async () => {
      if (type === "CALL_PATIENT") await callPatientAction(appointmentId);
      else if (type === "MARK_NO_SHOW") await markNoShowAction(appointmentId);
      else await updateAppointmentStatusAction({ appointmentId, status: "CONFIRMADO" });
      await load();
    });
  }

  if (!data) return <MobileSkeleton rows={4} />;

  const attended = data.finalized.length;
  const noShows = data.noShows.length;

  return (
    <div
      className="space-y-4"
      onTouchStart={(e) => {
        if (window.scrollY === 0) setPullY(e.touches[0].clientY);
      }}
      onTouchEnd={async (e) => {
        if (pullY && e.changedTouches[0].clientY - pullY > 80) await load();
        setPullY(0);
      }}
    >
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg border p-3 dark:border-zinc-800">
          <p className="text-2xl font-semibold">{attended}</p>
          <p className="text-zinc-500">Atendidos</p>
        </div>
        <div className="rounded-lg border p-3 dark:border-zinc-800">
          <p className="text-2xl font-semibold">{noShows}</p>
          <p className="text-zinc-500">Faltas</p>
        </div>
        <div className="rounded-lg border p-3 dark:border-zinc-800">
          <p className="text-2xl font-semibold">{data.queue.length}</p>
          <p className="text-zinc-500">Na fila</p>
        </div>
      </div>

      {offline && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Dados do cache offline — ações serão sincronizadas
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-medium">Fila agora</h2>
        {data.queue.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhum paciente aguardando</p>
        )}
        {data.queue.map((item) => (
          <article
            key={item.id}
            className={`rounded-xl border p-4 dark:border-zinc-800 ${
              item.arrivedAt ? "border-l-4 border-l-emerald-500" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {item.patient.socialName ?? item.patient.fullName}
                </p>
                <p className="text-sm text-zinc-500">
                  {item.service.name} · {item.waitMinutes ?? 0} min
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
                {item.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                className="min-h-11 rounded-md bg-blue-600 px-4 text-sm font-medium text-white"
                onClick={() =>
                  void handleOfflineAction(
                    "CALL_PATIENT",
                    item.id,
                    item.updatedAt?.toISOString?.(),
                  )
                }
              >
                Chamar
              </button>
              <button
                type="button"
                disabled={isPending}
                className="min-h-11 rounded-md border px-4 text-sm dark:border-zinc-700"
                onClick={() => void handleOfflineAction("CONFIRM_APPOINTMENT", item.id)}
              >
                Confirmar
              </button>
              <button
                type="button"
                disabled={isPending}
                className="min-h-11 rounded-md border border-red-200 px-4 text-sm text-red-700 dark:border-red-900 dark:text-red-300"
                onClick={() => void handleOfflineAction("MARK_NO_SHOW", item.id)}
              >
                Faltou
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
