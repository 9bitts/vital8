"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Role } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  calculateAge,
  formatCpf,
  formatPhone,
} from "@/lib/crypto/search-hash";
import {
  canAdminPatients,
  canViewPatientHealth,
  canWritePatients,
} from "@/modules/patients/lib/permissions";
import {
  anonymizePatientAction,
  exportLgpdAction,
  exportLgpdPdfAction,
  inactivatePatientAction,
} from "@/modules/patients/actions/patient.actions";
import type { LgpdExportData } from "@/modules/patients/services/patient.service";

type TimelineEntry = {
  id: string;
  action: string;
  createdAt: Date;
  user: { id: string; name: string } | null;
};

const ACTION_LABELS: Record<string, string> = {
  "patient.create": "Paciente cadastrado",
  "patient.create.quick": "Cadastro rápido",
  "patient.update.personal": "Dados pessoais atualizados",
  "patient.update.contact": "Contato atualizado",
  "patient.view": "Ficha visualizada",
  "patient.consent.record": "Consentimento LGPD registrado",
  "patient.document.upload": "Documento anexado",
  "patient.inactivate": "Paciente inativado",
  "patient.merge": "Registro mesclado",
  "patient.export.lgpd": "Exportação LGPD (JSON)",
  "patient.export.lgpd.pdf": "Exportação LGPD (PDF)",
  "patient.anonymize": "Paciente anonimizado",
};

type Props = {
  data: LgpdExportData;
  timeline: TimelineEntry[];
  role: Role;
};

export function PatientProfile({ data, timeline, role }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [showAnonymize, setShowAnonymize] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const p = data.patient;
  const canAdmin = canAdminPatients(role);
  const canWrite = canWritePatients(role);
  const showHealth = canViewPatientHealth(role);

  const primaryInsurance = data.insurancePlans.find((pl) => pl.isPrimary) ?? data.insurancePlans[0];
  const age = p.birthDate ? calculateAge(new Date(p.birthDate)) : null;

  function handleExportJson() {
    startTransition(async () => {
      const result = await exportLgpdAction(p.id);
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      const blob = new Blob([result.data!], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lgpd-${p.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Exportação JSON concluída");
    });
  }

  function handleExportPdf() {
    startTransition(async () => {
      const result = await exportLgpdPdfAction(p.id);
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      const bytes = Uint8Array.from(atob(result.data!), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lgpd-${p.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Exportação PDF concluída");
    });
  }

  function handleInactivate() {
    if (!confirm("Inativar este paciente?")) return;
    startTransition(async () => {
      const result = await inactivatePatientAction(p.id);
      if (!result.success) setMessage(result.error);
      else router.refresh();
    });
  }

  function handleAnonymize() {
    startTransition(async () => {
      const result = await anonymizePatientAction({
        patientId: p.id,
        confirmName,
        confirmPhrase: confirmPhrase as "ANONIMIZAR",
      });
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      router.push("/app/pacientes");
    });
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-6 border-b bg-white/95 px-6 py-4 backdrop-blur">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-xl font-semibold text-zinc-600">
            {p.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-semibold">{p.fullName}</h1>
            {p.socialName && (
              <p className="text-sm text-zinc-600">Nome social: {p.socialName}</p>
            )}
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-zinc-600">
              {age !== null && <span>{age} anos</span>}
              {primaryInsurance && (
                <span>Convênio: {primaryInsurance.insurerName}</span>
              )}
              {!primaryInsurance && <span>Particular</span>}
              {p.phones[0] && (
                <span>{formatPhone(p.phones[0].number)}</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.isIncomplete && <Badge variant="warning">Incompleto</Badge>}
              {!p.isActive && <Badge variant="outline">Inativo</Badge>}
              {p.tags.map((t) => (
                <Badge key={t} variant="secondary">{t}</Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canWrite && (
              <Button variant="outline" asChild>
                <Link href={`/app/pacientes/${p.id}/editar`}>Editar</Link>
              </Button>
            )}
            {canWrite && p.isActive && (
              <Button variant="outline" onClick={handleInactivate} disabled={isPending}>
                Inativar
              </Button>
            )}
            {canAdmin && (
              <>
                <Button variant="outline" onClick={handleExportJson} disabled={isPending}>
                  JSON LGPD
                </Button>
                <Button variant="outline" onClick={handleExportPdf} disabled={isPending}>
                  PDF LGPD
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowAnonymize(true)}
                  disabled={isPending}
                >
                  Anonimizar
                </Button>
              </>
            )}
          </div>
        </div>

        {showHealth && data.allergies.length > 0 && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <strong>Alergia:</strong>{" "}
            {data.allergies.map((a) => a.substance).join(", ")}
          </div>
        )}
      </div>

      {message && <p className="text-sm text-zinc-600">{message}</p>}

      {showAnonymize && canAdmin && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
          <h3 className="font-medium text-red-900">Confirmação dupla — anonimização</h3>
          <p className="text-sm text-red-800">
            Digite o nome completo do paciente e a palavra ANONIMIZAR para confirmar.
          </p>
          <div>
            <Label htmlFor="confirmName">Nome completo</Label>
            <Input
              id="confirmName"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="confirmPhrase">Digite ANONIMIZAR</Label>
            <Input
              id="confirmPhrase"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleAnonymize} disabled={isPending}>
              Confirmar anonimização
            </Button>
            <Button variant="outline" onClick={() => setShowAnonymize(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">Dados pessoais</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">CPF</dt>
              <dd>{p.cpf ? formatCpf(p.cpf) : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Nascimento</dt>
              <dd>
                {p.birthDate
                  ? new Date(p.birthDate).toLocaleDateString("pt-BR")
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">E-mail</dt>
              <dd>{p.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Profissão</dt>
              <dd>{p.profession ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">Convênios</h2>
          {data.insurancePlans.length === 0 ? (
            <p className="text-sm text-zinc-500">Particular</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.insurancePlans.map((plan) => (
                <li key={plan.id}>
                  <div className="font-medium">{plan.insurerName}</div>
                  <div className="text-zinc-500">Carteirinha: {plan.cardNumber}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {showHealth && (data.allergies.length > 0 || data.chronicConditions.length > 0) && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">Saúde</h2>
          <ul className="text-sm space-y-1">
            {data.allergies.map((a) => (
              <li key={a.id}>Alergia: {a.substance}</li>
            ))}
            {data.chronicConditions.map((c) => (
              <li key={c.id}>Condição: {c.condition}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 font-medium">Linha do tempo</h2>
        <div className="space-y-3 text-sm text-zinc-600">
          <div className="flex gap-3 border-l-2 border-zinc-200 pl-4">
            <span className="text-zinc-400 shrink-0">
              {new Date(p.createdAt).toLocaleString("pt-BR")}
            </span>
            <span>Paciente cadastrado no sistema</span>
          </div>
          {timeline.map((entry) => (
            <div key={entry.id} className="flex gap-3 border-l-2 border-zinc-200 pl-4">
              <span className="text-zinc-400 shrink-0">
                {new Date(entry.createdAt).toLocaleString("pt-BR")}
              </span>
              <span>
                {ACTION_LABELS[entry.action] ?? entry.action}
                {entry.user ? ` — ${entry.user.name}` : ""}
              </span>
            </div>
          ))}
          {data.documents.map((d) => (
            <div key={d.id} className="flex gap-3 border-l-2 border-zinc-200 pl-4">
              <span className="text-zinc-400 shrink-0">
                {new Date(d.createdAt).toLocaleString("pt-BR")}
              </span>
              <span>Documento: {d.fileName}</span>
            </div>
          ))}
          {data.consents.map((c) => (
            <div key={c.id} className="flex gap-3 border-l-2 border-zinc-200 pl-4">
              <span className="text-zinc-400 shrink-0">
                {new Date(c.grantedAt).toLocaleString("pt-BR")}
              </span>
              <span>Consentimento: {c.termKey}</span>
            </div>
          ))}
          <p className="text-xs text-zinc-400 italic">
            Consultas e pagamentos serão exibidos a partir da Fase 3.
          </p>
        </div>
      </section>
    </div>
  );
}
