"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkInAction,
  callPatientAction,
  cancelAppointmentAction,
  getReceptionQueueAction,
  markNoShowAction,
  addWaitingListEntryAction,
} from "@/modules/scheduling/actions/reception.actions";
import {
  updateAppointmentStatusAction,
} from "@/modules/scheduling/actions/appointment.actions";
import { STATUS_LABELS } from "@/modules/scheduling/lib/labels";
import { startEncounterAction } from "@/modules/emr/actions/emr.actions";
import { CheckoutDialog } from "@/modules/finance/components/checkout-dialog";
import { NoShowRiskPanel } from "@/modules/ai/components/no-show-risk-panel";

type QueueData = Awaited<ReturnType<typeof getReceptionQueueAction>>;

export function ReceptionBoard() {
  const router = useRouter();
  const [data, setData] = useState<QueueData | null>(null);
  const [pending, startTransition] = useTransition();
  const [cancelReason, setCancelReason] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [waitPatientId, setWaitPatientId] = useState("");
  const [waitServiceId, setWaitServiceId] = useState("");

  const load = useCallback(() => {
    startTransition(async () => {
      const q = await getReceptionQueueAction();
      setData(q);
    });
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  if (!data) {
    return <p className="text-sm text-zinc-500">Carregando fila…</p>;
  }

  const waitLimit = data.waitLimitMinutes;

  function action(fn: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (!r.success) alert(r.error);
      load();
    });
  }

  return (
    <div className="space-y-6">
      <NoShowRiskPanel />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fila do dia</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={pending}>
            Atualizar
          </Button>
          <Link href={`/painel/${data.orgSlug}`} target="_blank">
            <Button size="sm" variant="outline">
              Abrir painel TV
            </Button>
          </Link>
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-medium text-zinc-600">
          Aguardando atendimento
        </h3>
        <div className="space-y-2">
          {data.queue.length === 0 && (
            <p className="text-sm text-zinc-400">Ninguém na fila.</p>
          )}
          {data.queue.map((a) => {
            const overLimit =
              a.waitMinutes !== null && a.waitMinutes > waitLimit;
            return (
              <div
                key={a.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded border p-3 ${overLimit ? "border-red-400 bg-red-50" : "bg-white"}`}
              >
                <div>
                  <span className="font-medium">
                    #{a.queueNumber ?? "—"}{" "}
                    {a.patient.socialName || a.patient.fullName}
                  </span>
                  <span className="ml-2 text-sm text-zinc-500">
                    {a.professional.displayName} · {a.service.name}
                    {a.room ? ` · ${a.room.name}` : ""}
                  </span>
                  {a.waitMinutes !== null && (
                    <Badge
                      variant={overLimit ? "warning" : "secondary"}
                      className="ml-2"
                    >
                      Espera: {a.waitMinutes} min
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  {a.status === "AGUARDANDO" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => action(() => callPatientAction(a.id))}
                      >
                        Chamar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          action(() =>
                            updateAppointmentStatusAction({
                              appointmentId: a.id,
                              status: "EM_ATENDIMENTO",
                            }),
                          )
                        }
                      >
                        Iniciar
                      </Button>
                    </>
                  )}
                  {a.status === "EM_ATENDIMENTO" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          action(() =>
                            updateAppointmentStatusAction({
                              appointmentId: a.id,
                              status: "FINALIZADO",
                            }),
                          )
                        }
                      >
                        Finalizar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-zinc-600">
          Finalizados — checkout
        </h3>
        <div className="space-y-1">
          {data.finalized.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between rounded border bg-white p-2 text-sm"
            >
              <span>
                {a.patient.socialName || a.patient.fullName} · {a.service.name}
                {a.sale ? " · pago" : " · pendente"}
              </span>
              {!a.sale && (
                <CheckoutDialog appointmentId={a.id} onDone={load} />
              )}
            </div>
          ))}
          {data.finalized.length === 0 && (
            <p className="text-sm text-zinc-400">Nenhum finalizado aguardando recebimento.</p>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-zinc-600">
          Próximos horários
        </h3>
        <div className="space-y-1">
          {data.upcoming.slice(0, 10).map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between rounded border bg-white p-2 text-sm"
            >
              <span>
                {a.startsAt.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                — {a.patient.socialName || a.patient.fullName} ·{" "}
                {STATUS_LABELS[a.status]}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => action(() => checkInAction(a.id))}
                >
                  Check-in
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await startEncounterAction({
                        appointmentId: a.id,
                      });
                      if (!r.success) {
                        alert(r.error);
                        return;
                      }
                      router.push(`/app/atendimento/${r.data!.encounterId}`);
                    })
                  }
                >
                  Iniciar atendimento
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    action(() =>
                      updateAppointmentStatusAction({
                        appointmentId: a.id,
                        status: "CONFIRMADO",
                      }),
                    )
                  }
                >
                  Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCancelId(a.id)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => action(() => markNoShowAction(a.id))}
                >
                  Falta
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {cancelId && (
        <div className="rounded border bg-amber-50 p-3">
          <Label>Motivo do cancelamento</Label>
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="mb-2"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                action(async () => {
                  const r = await cancelAppointmentAction(cancelId, cancelReason);
                  setCancelId(null);
                  setCancelReason("");
                  return r;
                })
              }
            >
              Confirmar cancelamento
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCancelId(null)}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      <section>
        <h3 className="mb-2 text-sm font-medium text-zinc-600">
          Faltas do dia ({data.noShows.length})
        </h3>
        {data.noShows.map((a) => (
          <div key={a.id} className="text-sm text-zinc-500">
            {a.startsAt.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            — {a.patient.fullName}
          </div>
        ))}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-zinc-600">
          Lista de espera
        </h3>
        {data.waitingList.map((w) => (
          <div key={w.id} className="text-sm">
            {w.patient.socialName || w.patient.fullName} — {w.service.name}
            {w.preferredProfessional
              ? ` (${w.preferredProfessional.displayName})`
              : ""}
            <Badge className="ml-1">P{w.priority}</Badge>
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <Input
            placeholder="ID paciente"
            value={waitPatientId}
            onChange={(e) => setWaitPatientId(e.target.value)}
          />
          <Input
            placeholder="ID serviço"
            value={waitServiceId}
            onChange={(e) => setWaitServiceId(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() =>
              action(() =>
                addWaitingListEntryAction({
                  patientId: waitPatientId,
                  serviceId: waitServiceId,
                }),
              )
            }
          >
            Adicionar
          </Button>
        </div>
      </section>
    </div>
  );
}
