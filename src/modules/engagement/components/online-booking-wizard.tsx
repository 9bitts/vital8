"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmBookingAction,
  getBookingContextAction,
  getBookingProfessionalsAction,
  getBookingSlotsAction,
  requestBookingOtpAction,
} from "@/modules/engagement/actions/public-booking.actions";

type Props = { orgSlug: string };

export function OnlineBookingWizard({ orgSlug }: Props) {
  const [step, setStep] = useState(1);
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof getBookingContextAction>>>(null);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [professionals, setProfessionals] = useState<
    Awaited<ReturnType<typeof getBookingProfessionalsAction>>
  >([]);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Array<{ startsAt: Date; endsAt: Date }>>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [utm, setUtm] = useState<Record<string, string | undefined>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getBookingContextAction(orgSlug).then(setCtx);
    const params = new URLSearchParams(window.location.search);
    setUtm({
      utmSource: params.get("utm_source") ?? undefined,
      utmMedium: params.get("utm_medium") ?? undefined,
      utmCampaign: params.get("utm_campaign") ?? undefined,
      utmTerm: params.get("utm_term") ?? undefined,
      utmContent: params.get("utm_content") ?? undefined,
    });
  }, [orgSlug]);

  if (!ctx) {
    return <p className="text-sm text-zinc-500">Agendamento online indisponível.</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">{ctx.orgName}</h1>
      {ctx.welcomeText && <p className="text-sm text-zinc-600">{ctx.welcomeText}</p>}

      {step === 1 && (
        <div className="space-y-2">
          <Label>Serviço</Label>
          <select
            className="w-full rounded border px-3 py-2"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {ctx.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.durationMinutes} min)
                {s.isTeleconsult ? " — teleconsulta" : ""}
              </option>
            ))}
          </select>
          <Button
            disabled={!serviceId || pending}
            onClick={() =>
              startTransition(async () => {
                setProfessionals(await getBookingProfessionalsAction(orgSlug, serviceId));
                setStep(2);
              })
            }
          >
            Continuar
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <Label>Profissional</Label>
          <select
            className="w-full rounded border px-3 py-2"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button
            disabled={!professionalId || !date || pending}
            onClick={() =>
              startTransition(async () => {
                const s = await getBookingSlotsAction({
                  orgSlug,
                  professionalId,
                  serviceId,
                  dateIso: date,
                });
                setSlots(s);
                setStep(3);
              })
            }
          >
            Ver horários
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2">
          <Label>Horário</Label>
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => (
              <Button
                key={s.startsAt.toISOString()}
                variant={selectedSlot === s.startsAt.toISOString() ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSlot(s.startsAt.toISOString())}
              >
                {s.startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </Button>
            ))}
          </div>
          {slots.length === 0 && <p className="text-sm text-zinc-500">Sem horários nesta data.</p>}
          <Button disabled={!selectedSlot} onClick={() => setStep(4)}>Identificar-se</Button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-2">
          <Label>Telefone (WhatsApp/SMS)</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11999998888" />
          <Button
            disabled={phone.length < 10 || pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await requestBookingOtpAction(orgSlug, phone);
                  setMessage("Código enviado (veja o console em dev).");
                  setStep(5);
                } catch (e) {
                  setMessage(e instanceof Error ? e.message : "Erro");
                }
              })
            }
          >
            Enviar código
          </Button>
        </div>
      )}

      {step === 5 && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              try {
                const r = await confirmBookingAction({
                  orgSlug,
                  phone,
                  otp,
                  fullName: fullName || undefined,
                  professionalId,
                  serviceId,
                  startsAtIso: selectedSlot,
                  ...utm,
                });
                setMessage(
                  r.pendingApproval
                    ? `Solicitação enviada! Aguardando aprovação da clínica.`
                    : `Consulta confirmada para ${new Date(r.startsAt).toLocaleString("pt-BR")}`,
                );
                setStep(6);
              } catch (err) {
                setMessage(err instanceof Error ? err.message : "Erro");
              }
            });
          }}
        >
          <Label>Código OTP</Label>
          <Input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
          <Label>Nome completo (se novo cadastro)</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Button type="submit" disabled={otp.length !== 6 || pending}>Confirmar agendamento</Button>
        </form>
      )}

      {step === 6 && message && <p className="text-green-700 text-sm">{message}</p>}
      {message && step < 6 && <p className="text-sm text-amber-700">{message}</p>}
    </div>
  );
}
