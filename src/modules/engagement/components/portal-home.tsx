"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelPortalAppointmentAction,
  getPortalDashboardAction,
  requestCorrectionAction,
  requestPortalLoginOtpAction,
  verifyPortalLoginAction,
} from "@/modules/engagement/actions/portal.actions";

type Props = { orgSlug: string };

export function PortalHome({ orgSlug }: Props) {
  const [dashboard, setDashboard] = useState<
    Awaited<ReturnType<typeof getPortalDashboardAction>>
  >(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "home">("phone");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      const d = await getPortalDashboardAction();
      if (d) {
        setDashboard(d);
        setStep("home");
      }
    });

  useEffect(() => {
    load();
  }, []);

  if (step !== "home") {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-lg border p-6">
        <h1 className="text-xl font-semibold">Portal do paciente</h1>
        {step === "phone" && (
          <>
            <Label>Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await requestPortalLoginOtpAction(orgSlug, phone);
                  setMessage("Código enviado (console em dev).");
                  setStep("otp");
                })
              }
            >
              Receber código
            </Button>
          </>
        )}
        {step === "otp" && (
          <>
            <Label>Código</Label>
            <Input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await verifyPortalLoginAction(orgSlug, phone, otp);
                  load();
                })
              }
            >
              Entrar
            </Button>
          </>
        )}
        {message && <p className="text-sm text-zinc-600">{message}</p>}
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-xl font-semibold">Portal — {dashboard.org.name}</h1>

      <section>
        <h2 className="font-medium">Próximas consultas</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {dashboard.upcoming.map((a) => (
            <li key={a.id} className="flex justify-between rounded border p-2">
              <span>
                {a.startsAt.toLocaleString("pt-BR")} — {a.service.name} com{" "}
                {a.professional.displayName}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await cancelPortalAppointmentAction(a.id);
                      load();
                    } catch (e) {
                      setMessage(e instanceof Error ? e.message : "Erro");
                    }
                  })
                }
              >
                Cancelar
              </Button>
            </li>
          ))}
          {dashboard.upcoming.length === 0 && (
            <li className="text-zinc-500">Nenhuma consulta agendada.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="font-medium">Histórico (sem conteúdo clínico)</h2>
        <ul className="mt-2 text-sm space-y-1">
          {dashboard.history.map((e) => (
            <li key={e.id}>
              {e.startedAt.toLocaleDateString("pt-BR")} —{" "}
              {e.appointment?.service.name ?? e.specialty ?? "Atendimento"} ({e.modality})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-medium">Documentos liberados</h2>
        <p className="text-sm text-zinc-500">{dashboard.documents.length} documento(s)</p>
      </section>

      <section>
        <h2 className="font-medium">Pagamentos em aberto</h2>
        <ul className="text-sm space-y-1">
          {dashboard.receivables.map((r) => (
            <li key={r.id}>
              {r.description} — R$ {((r.totalCents - r.paidCents) / 100).toFixed(2)}{" "}
              <a href={`/pagamento/${r.id}`} className="text-blue-700 underline">
                Pagar
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-medium">Solicitar correção de dados</h2>
        <Button
          variant="outline"
          onClick={() =>
            startTransition(async () => {
              await requestCorrectionAction({ telefone: "novo número" }, "Corrigir telefone");
              setMessage("Solicitação enviada à recepção.");
            })
          }
        >
          Solicitar correção
        </Button>
      </section>

      {message && <p className="text-sm text-green-700">{message}</p>}
    </div>
  );
}
