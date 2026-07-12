"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCpf, formatPhone } from "@/lib/crypto/search-hash";
import {
  anonymizePatientAction,
  exportLgpdAction,
} from "@/modules/patients/actions/patient.actions";
import type { LgpdExportData } from "@/modules/patients/services/patient.service";

type Props = {
  data: LgpdExportData;
  canAdmin: boolean;
};

export function PatientProfile({ data, canAdmin }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const p = data.patient;

  function handleExport() {
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
      setMessage("Exportação LGPD concluída");
    });
  }

  function handleAnonymize() {
    if (!confirm("Anonimizar paciente? Esta ação não pode ser desfeita.")) return;
    startTransition(async () => {
      const result = await anonymizePatientAction(p.id);
      if (!result.success) setMessage(result.error);
      else router.push("/app/pacientes");
    });
  }

  const hasHealthAlerts =
    data.allergies.length > 0 ||
    data.chronicConditions.length > 0 ||
    data.medications.filter((m) => m.isActive).length > 0;

  return (
    <div className="space-y-6">
      {hasHealthAlerts && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-medium text-amber-900">Alertas de saúde</h3>
          {data.allergies.length > 0 && (
            <p className="text-sm text-amber-800">
              Alergias: {data.allergies.map((a) => a.substance).join(", ")}
            </p>
          )}
          {data.chronicConditions.length > 0 && (
            <p className="text-sm text-amber-800">
              Condições: {data.chronicConditions.map((c) => c.condition).join(", ")}
            </p>
          )}
          {data.medications.filter((m) => m.isActive).length > 0 && (
            <p className="text-sm text-amber-800">
              Medicamentos:{" "}
              {data.medications.filter((m) => m.isActive).map((m) => m.name).join(", ")}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{p.fullName}</h1>
          {p.socialName && (
            <p className="text-zinc-600">Nome social: {p.socialName}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {p.isIncomplete && <Badge variant="warning">Cadastro incompleto</Badge>}
            {!p.isActive && <Badge variant="outline">Inativo</Badge>}
            {p.tags.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/app/pacientes/${p.id}/editar`}>Editar</Link>
          </Button>
          {canAdmin && (
            <>
              <Button variant="outline" onClick={handleExport} disabled={isPending}>
                Exportar LGPD
              </Button>
              <Button variant="destructive" onClick={handleAnonymize} disabled={isPending}>
                Anonimizar
              </Button>
            </>
          )}
        </div>
      </div>

      {message && <p className="text-sm text-zinc-600">{message}</p>}

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
              <dt className="text-zinc-500">Telefone</dt>
              <dd>
                {p.phones[0] ? formatPhone(p.phones[0].number) : "—"}
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
                  <div className="text-zinc-500">
                    Carteirinha: {plan.cardNumber}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 font-medium">Linha do tempo</h2>
        <div className="space-y-3 text-sm text-zinc-600">
          <div className="flex gap-3 border-l-2 border-zinc-200 pl-4">
            <span className="text-zinc-400">
              {new Date(p.createdAt).toLocaleDateString("pt-BR")}
            </span>
            <span>Paciente cadastrado no sistema</span>
          </div>
          {data.documents.map((d) => (
            <div key={d.id} className="flex gap-3 border-l-2 border-zinc-200 pl-4">
              <span className="text-zinc-400">
                {new Date(d.createdAt).toLocaleDateString("pt-BR")}
              </span>
              <span>Documento anexado: {d.fileName}</span>
            </div>
          ))}
          {data.consents.map((c) => (
            <div key={c.id} className="flex gap-3 border-l-2 border-zinc-200 pl-4">
              <span className="text-zinc-400">
                {new Date(c.grantedAt).toLocaleDateString("pt-BR")}
              </span>
              <span>Consentimento LGPD: {c.termKey}</span>
            </div>
          ))}
          <p className="text-xs text-zinc-400 italic">
            Consultas, pagamentos e comunicações serão exibidos aqui a partir da Fase 3.
          </p>
        </div>
      </section>
    </div>
  );
}
