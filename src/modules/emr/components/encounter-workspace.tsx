"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "@/lib/money";
import {
  addAmendmentAction,
  createCertificateAction,
  createExamRequestAction,
  createExamResultAction,
  createPrescriptionAction,
  getEncounterAction,
  getPatientEmrHistoryAction,
  getPrescriptionPdfAction,
  listActiveFormTemplatesForSpecialtyAction,
  repeatPrescriptionAction,
  saveBodyChartEntryAction,
  saveFormResponseAction,
  saveOdontogramEntryAction,
  searchDrugsAction,
  signEncounterAction,
  updateSectionAction,
} from "@/modules/emr/actions/emr.actions";
import {
  previewPrescriptionSafetyAction,
  sendPrescriptionToPatientAction,
} from "@/modules/emr/actions/prescription.actions";
import { OdontogramEditor } from "./odontogram-editor";
import { BodyChartEditor } from "./body-chart-editor";
import { ClinicalCopilotPanel } from "@/modules/ai/components/clinical-copilot-panel";
import { TeleconsultPanel } from "@/modules/engagement/components/teleconsult-panel";

type EncounterData = Awaited<ReturnType<typeof getEncounterAction>>;

function isFullEncounterData(
  data: EncounterData,
): data is Extract<EncounterData, { sections: unknown }> {
  return "sections" in data;
}

type Props = {
  encounterId: string;
};

export function EncounterWorkspace({ encounterId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<EncounterData | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [amendment, setAmendment] = useState("");
  const [drugQuery, setDrugQuery] = useState("");
  const [drugs, setDrugs] = useState<
    Awaited<ReturnType<typeof searchDrugsAction>>
  >([]);
  const [rxItems, setRxItems] = useState<
    {
      drugCatalogId?: string | null;
      drugName: string;
      dosage: string;
      route: string;
    }[]
  >([{ drugName: "", dosage: "", route: "" }]);
  const [rxType, setRxType] = useState<"COMUM" | "CONTROLE_ESPECIAL">("COMUM");
  const [safetyAlerts, setSafetyAlerts] = useState<
    Awaited<ReturnType<typeof previewPrescriptionSafetyAction>>["alerts"]
  >([]);
  const [history, setHistory] = useState<
    Awaited<ReturnType<typeof getPatientEmrHistoryAction>> | null
  >(null);
  const [materials, setMaterials] = useState<
    Awaited<
      ReturnType<
        typeof import("@/modules/inventory/actions/inventory.actions").getEncounterMaterialsAction
      >
    > | null
  >(null);
  const [formTemplates, setFormTemplates] = useState<
    Awaited<ReturnType<typeof listActiveFormTemplatesForSpecialtyAction>>
  >([]);
  const [examValues, setExamValues] = useState<
    { name: string; value: string; unit: string; referenceRange: string }[]
  >([{ name: "", value: "", unit: "", referenceRange: "" }]);

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        const d = await getEncounterAction(encounterId);
        setData(d);
        if ("sections" in d && d.encounter?.patientId) {
          setHistory(await getPatientEmrHistoryAction(d.encounter.patientId));
          setFormTemplates(
            await listActiveFormTemplatesForSpecialtyAction(d.encounter.specialty),
          );
          try {
            const { getEncounterMaterialsAction } = await import(
              "@/modules/inventory/actions/inventory.actions"
            );
            setMaterials(await getEncounterMaterialsAction(encounterId));
          } catch {
            setMaterials(null);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar");
      }
    });
  }, [encounterId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (drugQuery.length < 2) return;
    const t = setTimeout(async () => {
      setDrugs(await searchDrugsAction({ query: drugQuery }));
    }, 300);
    return () => clearTimeout(t);
  }, [drugQuery]);

  async function submitPrescription(confirmOverride = false) {
    const items = rxItems.filter((i) => i.drugName && i.dosage);
    if (items.length === 0) {
      setError("Informe ao menos um medicamento com posologia");
      return;
    }

    const r = await createPrescriptionAction({
      encounterId,
      type: rxType,
      items,
      confirmSafetyOverride: confirmOverride,
    });

    if (!r.success) {
      const payload = r as {
        error: string;
        alerts?: typeof safetyAlerts;
      };
      if (payload.alerts?.length) {
        setSafetyAlerts(payload.alerts);
      }
      setError(r.error);
      return;
    }

    setSafetyAlerts([]);
    setRxItems([{ drugName: "", dosage: "", route: "" }]);
    if (r.data?.redirectUrl) {
      window.location.href = r.data.redirectUrl;
      return;
    }
    if (r.data?.warnings?.length) {
      setError(`Prescrição salva com alertas: ${r.data.warnings.join("; ")}`);
    }
    load();
  }

  if (!data) {
    return <p className="text-sm text-zinc-500">Carregando atendimento…</p>;
  }

  if ("metadataOnly" in data && data.metadataOnly) {
    return (
      <div>
        <p>Metadados do atendimento — conteúdo clínico restrito ao seu perfil.</p>
        <p>Status: {data.encounter.status}</p>
      </div>
    );
  }

  if (!isFullEncounterData(data)) {
    return <p className="text-sm text-zinc-500">Dados indisponíveis.</p>;
  }

  const { encounter, sections, amendments } = data;
  const isSigned = encounter.status === "ASSINADO";
  const allergies = encounter.patient.allergies ?? [];
  const conditions = encounter.patient.chronicConditions ?? [];
  const soapSection = sections.find((s) => s.sectionType === "EVOLUCAO_SOAP");
  const anamnesisSection = sections.find((s) => s.sectionType === "ANAMNESE");
  const soapData = (soapSection?.structuredData ?? {}) as Record<string, string>;

  function applySoapField(field: string, value: string) {
    if (!soapSection) {
      setError("Seção SOAP não encontrada no atendimento");
      return;
    }
    saveSection(soapSection.id, undefined, {
      ...soapData,
      [field]: value,
    });
  }

  function saveSection(
    sectionId: string,
    content?: string,
    structuredData?: Record<string, unknown>,
  ) {
    startTransition(async () => {
      const r = await updateSectionAction({
        encounterId,
        sectionId,
        content,
        structuredData,
      });
      if (!r.success) {
        setError(r.error);
        return;
      }
      load();
    });
  }

  function handleSign() {
    if (!confirm("Assinar e finalizar atendimento? Esta ação é irreversível.")) {
      return;
    }
    startTransition(async () => {
      const r = await signEncounterAction({ encounterId });
      if (!r.success) {
        setError(r.error);
        return;
      }
      if (r.data?.redirectUrl) {
        window.location.href = r.data.redirectUrl;
        return;
      }
      load();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {(allergies.length > 0 || conditions.length > 0) && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <strong>Alertas clínicos:</strong>{" "}
          {allergies.map((a) => `Alergia: ${a.substance}`).join(" · ")}
          {conditions.length > 0 && " | "}
          {conditions.map((c) => c.condition).join(" · ")}
        </div>
      )}

      <ClinicalCopilotPanel
        patientId={encounter.patientId}
        encounterId={encounterId}
        anamnesisText={anamnesisSection?.content ?? ""}
        disabled={isSigned}
        onApplySoapField={soapSection ? applySoapField : undefined}
      />

      <TeleconsultPanel
        encounterId={encounterId}
        modality={encounter.modality}
        disabled={isSigned}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {encounter.patient.socialName || encounter.patient.fullName}
          </h1>
          <p className="text-sm text-zinc-500">
            {encounter.professional.displayName} · {encounter.specialty} ·{" "}
            {encounter.status}
            {encounter.contentHash && (
              <span className="ml-2 font-mono text-xs">
                hash: {encounter.contentHash.slice(0, 12)}…
                {typeof encounter.signatureMeta === "object" &&
                  encounter.signatureMeta !== null &&
                  "verificationCode" in encounter.signatureMeta && (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={`/verificar/${String((encounter.signatureMeta as Record<string, string>).verificationCode)}`}
                        className="underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        verificar
                      </a>
                    </>
                  )}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/app/pacientes/${encounter.patientId}`}>
            <Button variant="outline" size="sm">
              Ficha
            </Button>
          </Link>
          {!isSigned && (
            <Button size="sm" onClick={handleSign} disabled={pending}>
              Assinar e finalizar
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <aside className="space-y-3">
          <h2 className="font-medium">Histórico</h2>
          <details className="rounded border p-2 text-sm">
            <summary>
              Encontros anteriores ({history?.encounters.length ?? 0})
            </summary>
            <ul className="mt-2 space-y-1">
              {(history?.encounters ?? [])
                .filter((e) => e.id !== encounterId)
                .map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/app/atendimento/${e.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      {e.startedAt.toLocaleDateString("pt-BR")} — {e.specialty}{" "}
                      ({e.status})
                    </Link>
                  </li>
                ))}
            </ul>
          </details>
          <details className="rounded border p-2 text-sm">
            <summary>
              Prescrições ({history?.prescriptions.length ?? 0})
            </summary>
            <ul className="mt-2 space-y-2">
              {(history?.prescriptions ?? []).map((rx) => (
                <li key={rx.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    {rx.items.map((i) => i.drugName).join(", ")} —{" "}
                    {rx.createdAt.toLocaleDateString("pt-BR")}
                  </span>
                  {!isSigned && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await repeatPrescriptionAction({
                            prescriptionId: rx.id,
                            encounterId,
                          });
                          if (!r.success) setError(r.error);
                          else load();
                        })
                      }
                    >
                      Repetir receita
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      startTransition(async () => {
                        const r = await getPrescriptionPdfAction(rx.id);
                        if (!r.success) {
                          setError("error" in r ? r.error : "Erro PDF");
                          return;
                        }
                        const bytes = Uint8Array.from(atob(r.data!), (c) =>
                          c.charCodeAt(0),
                        );
                        const blob = new Blob([bytes], {
                          type: "application/pdf",
                        });
                        window.open(URL.createObjectURL(blob), "_blank");
                      })
                    }
                  >
                    PDF
                  </Button>
                </li>
              ))}
            </ul>
          </details>
          {materials && materials.items.length > 0 && (
            <details className="rounded border p-2 text-sm" open>
              <summary>
                Materiais consumidos ({materials.items.length}) —{" "}
                {formatBRL(materials.costCents)}
              </summary>
              <ul className="mt-2 space-y-1">
                {materials.items.map((m) => (
                  <li key={m.id}>
                    {m.product.name}: {m.quantity} {m.product.consumeUnit}
                    {m.batchId ? " (lote)" : ""}
                  </li>
                ))}
              </ul>
              {materials.revenueCents > 0 && (
                <p className="mt-2 text-xs text-zinc-600">
                  Receita {formatBRL(materials.revenueCents)} · Margem{" "}
                  {formatBRL(materials.marginCents)}
                </p>
              )}
            </details>
          )}
          <details className="rounded border p-2 text-sm">
            <summary>Exames ({encounter.examResults.length})</summary>
            {encounter.examResults.map((ex) => (
              <div key={ex.id} className="mt-2 space-y-1">
                <div>{ex.fileName ?? "Resultado laboratorial"}</div>
                {ex.values.map((v) => (
                  <div key={v.id} className="text-xs text-zinc-600">
                    {v.name}: {v.value} {v.unit ?? ""}{" "}
                    {v.referenceRange ? `(ref: ${v.referenceRange})` : ""}
                  </div>
                ))}
                {ex.fileName && (
                  <a
                    href={`/api/emr/exames/${ex.id}/arquivo`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 text-xs hover:underline"
                  >
                    Ver anexo
                  </a>
                )}
              </div>
            ))}
          </details>
        </aside>

        <main className="space-y-4">
          {sections.map((section) => (
            <SectionEditor
              key={section.id}
              section={section}
              disabled={isSigned}
              onSave={saveSection}
            />
          ))}

          {encounter.specialty === "odontologia" && !isSigned && (
            <OdontogramEditor
              encounterId={encounterId}
              entries={encounter.odontogram?.entries ?? []}
              onSave={saveOdontogramEntryAction}
            />
          )}

          {encounter.specialty === "fisioterapia" && !isSigned && (
            <BodyChartEditor
              encounterId={encounterId}
              entries={encounter.bodyChartEntries ?? []}
              disabled={isSigned}
              onSave={async (input) => {
                const r = await saveBodyChartEntryAction(input);
                if (r.success) load();
                return r;
              }}
            />
          )}

          {formTemplates.length > 0 && !isSigned && (
            <FormResponsePanel
              encounterId={encounterId}
              templates={formTemplates}
              onSave={async (input) => {
                const r = await saveFormResponseAction(input);
                if (r.success) load();
                return r;
              }}
            />
          )}

          {!isSigned && (
            <div className="rounded border p-3 space-y-2">
              <h3 className="font-medium">Resultado de exame</h3>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const base64 = (reader.result as string).split(",")[1];
                    startTransition(async () => {
                      const r = await createExamResultAction({
                        encounterId,
                        fileName: file.name,
                        mimeType: file.type,
                        fileBase64: base64,
                        values: examValues.filter((v) => v.name && v.value),
                      });
                      if (!r.success) setError(r.error);
                      else load();
                    });
                  };
                  reader.readAsDataURL(file);
                }}
              />
              {examValues.map((v, i) => (
                <div key={i} className="grid grid-cols-4 gap-2">
                  <Input
                    placeholder="Parâmetro"
                    value={v.name}
                    onChange={(e) => {
                      const next = [...examValues];
                      next[i].name = e.target.value;
                      setExamValues(next);
                    }}
                  />
                  <Input
                    placeholder="Valor"
                    value={v.value}
                    onChange={(e) => {
                      const next = [...examValues];
                      next[i].value = e.target.value;
                      setExamValues(next);
                    }}
                  />
                  <Input
                    placeholder="Unidade"
                    value={v.unit}
                    onChange={(e) => {
                      const next = [...examValues];
                      next[i].unit = e.target.value;
                      setExamValues(next);
                    }}
                  />
                  <Input
                    placeholder="Referência"
                    value={v.referenceRange}
                    onChange={(e) => {
                      const next = [...examValues];
                      next[i].referenceRange = e.target.value;
                      setExamValues(next);
                    }}
                  />
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setExamValues([
                    ...examValues,
                    { name: "", value: "", unit: "", referenceRange: "" },
                  ])
                }
              >
                + valor estruturado
              </Button>
            </div>
          )}

          {!isSigned && (
            <div className="rounded border p-3 space-y-2">
              <h3 className="font-medium">Prescrição</h3>
              <div className="flex gap-2 text-sm">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={rxType === "COMUM"}
                    onChange={() => setRxType("COMUM")}
                  />
                  Receita comum
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={rxType === "CONTROLE_ESPECIAL"}
                    onChange={() => setRxType("CONTROLE_ESPECIAL")}
                  />
                  Controle especial (Port. 344)
                </label>
              </div>
              <Input
                placeholder="Buscar medicamento..."
                value={drugQuery}
                onChange={(e) => setDrugQuery(e.target.value)}
              />
              {drugs.length > 0 && (
                <ul className="text-sm">
                  {drugs.map((d) => (
                    <li
                      key={d.id}
                      className="cursor-pointer hover:bg-zinc-100"
                      onClick={() => {
                        setRxItems((prev) => [
                          ...prev,
                          {
                            drugCatalogId: d.id,
                            drugName: d.name,
                            dosage: "",
                            route: d.route ?? "",
                          },
                        ]);
                        setDrugQuery("");
                        setDrugs([]);
                      }}
                    >
                      {d.name}
                      {d.isControlled ? " (controlado)" : ""}
                    </li>
                  ))}
                </ul>
              )}
              {rxItems.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={item.drugName}
                    onChange={(e) => {
                      const next = [...rxItems];
                      next[i].drugName = e.target.value;
                      setRxItems(next);
                    }}
                    placeholder="Medicamento"
                  />
                  <Input
                    value={item.dosage}
                    onChange={(e) => {
                      const next = [...rxItems];
                      next[i].dosage = e.target.value;
                      setRxItems(next);
                    }}
                    placeholder="Posologia"
                  />
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const items = rxItems.filter((i) => i.drugName && i.dosage);
                      if (items.length === 0) return;
                      const result = await previewPrescriptionSafetyAction({
                        patientId: encounter.patientId,
                        items,
                      });
                      setSafetyAlerts(result.alerts);
                    })
                  }
                >
                  Verificar segurança
                </Button>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => startTransition(() => submitPrescription(false))}
                >
                  Salvar prescrição
                </Button>
                {safetyAlerts.some((a) => a.severity === "BLOCKING") && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => {
                      if (
                        !confirm(
                          "Há alertas bloqueantes. Confirma prescrição mesmo assim?",
                        )
                      ) {
                        return;
                      }
                      startTransition(() => submitPrescription(true));
                    }}
                  >
                    Prescrever com override
                  </Button>
                )}
              </div>
              {safetyAlerts.length > 0 && (
                <ul className="text-sm space-y-1">
                  {safetyAlerts.map((a, idx) => (
                    <li
                      key={idx}
                      className={
                        a.severity === "BLOCKING"
                          ? "text-red-700"
                          : "text-amber-700"
                      }
                    >
                      [{a.type}] {a.message} ({a.drugName})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {encounter.prescriptions.length > 0 && (
            <div className="rounded border p-3">
              <h3 className="font-medium mb-2">Receitas deste atendimento</h3>
              {encounter.prescriptions.map((rx) => (
                <div key={rx.id} className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <span>
                    {rx.type === "CONTROLE_ESPECIAL" ? "Controle especial" : "Comum"}
                    {rx.validationCode ? ` · CFM ${rx.validationCode}` : ""}
                    {rx.sentToPatientAt
                      ? ` · Enviada ${rx.sentToPatientAt.toLocaleString("pt-BR")}`
                      : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      startTransition(async () => {
                        const r = await getPrescriptionPdfAction(rx.id);
                        if (!r.success) {
                          setError("error" in r ? r.error : "Erro PDF");
                          return;
                        }
                        const bytes = Uint8Array.from(atob(r.data!), (c) =>
                          c.charCodeAt(0),
                        );
                        const blob = new Blob([bytes], { type: "application/pdf" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `receita-${rx.id}.pdf`;
                        a.click();
                        URL.revokeObjectURL(url);
                      })
                    }
                  >
                    PDF receita
                  </Button>
                  {!rx.sentToPatientAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        startTransition(async () => {
                          const r = await sendPrescriptionToPatientAction(rx.id);
                          if (!r.success) setError(r.error);
                          else load();
                        })
                      }
                    >
                      Enviar ao paciente
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!isSigned && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  startTransition(async () => {
                    const r = await createExamRequestAction({
                      encounterId,
                      exams: [{ examName: "Hemograma completo" }],
                    });
                    if (!r.success) setError(r.error);
                  })
                }
              >
                Solicitar exame
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  startTransition(async () => {
                    const r = await createCertificateAction({
                      encounterId,
                      type: "ATESTADO",
                      body: "Atesto que o paciente necessita de repouso por 2 dias.",
                      days: 2,
                    });
                    if (!r.success) setError(r.error);
                  })
                }
              >
                Emitir atestado
              </Button>
            </div>
          )}

          {isSigned && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 space-y-2">
              <h3 className="font-medium">Adendo (pós-assinatura)</h3>
              <Textarea
                value={amendment}
                onChange={(e) => setAmendment(e.target.value)}
                placeholder="Correção ou complemento..."
              />
              <Button
                size="sm"
                disabled={pending || !amendment}
                onClick={() =>
                  startTransition(async () => {
                    const r = await addAmendmentAction({
                      encounterId,
                      content: amendment,
                    });
                    if (!r.success) setError(r.error);
                    else {
                      setAmendment("");
                      load();
                    }
                  })
                }
              >
                Registrar adendo
              </Button>
              {amendments.map((a) => (
                <div key={a.id} className="text-sm border-t pt-2">
                  {a.createdAt.toLocaleString("pt-BR")}: {a.content}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function FormResponsePanel({
  encounterId,
  templates,
  onSave,
}: {
  encounterId: string;
  templates: Awaited<
    ReturnType<typeof listActiveFormTemplatesForSpecialtyAction>
  >;
  onSave: (input: {
    encounterId: string;
    versionId: string;
    answers: Record<string, unknown>;
  }) => Promise<{ success: boolean; error?: string }>;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const template = templates[0];
  const version = template?.versions[0];
  const fields =
    (version?.schema as { fields?: Array<{ id: string; label: string }> })
      ?.fields ?? [];

  if (!version) return null;

  return (
    <div className="rounded border p-3 space-y-2">
      <h3 className="font-medium">Formulário: {template.name}</h3>
      {fields.map((field) => (
        <div key={field.id}>
          <Label>{field.label}</Label>
          <Input
            value={answers[field.id] ?? ""}
            onChange={(e) =>
              setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
            }
          />
        </div>
      ))}
      <Button
        size="sm"
        onClick={() =>
          onSave({
            encounterId,
            versionId: version.id,
            answers,
          })
        }
      >
        Salvar formulário
      </Button>
    </div>
  );
}

function SectionEditor({
  section,
  disabled,
  onSave,
}: {
  section: {
    id: string;
    sectionType: string;
    content: string | null;
    structuredData: Record<string, unknown>;
    restrictedHidden: boolean;
  };
  disabled: boolean;
  onSave: (
    id: string,
    content?: string,
    structuredData?: Record<string, unknown>,
  ) => void;
}) {
  const [content, setContent] = useState(section.content ?? "");
  const soap = section.structuredData as {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };

  if (section.restrictedHidden) {
    return (
      <div className="rounded border border-zinc-300 bg-zinc-100 p-3 text-sm italic">
        {section.sectionType} — registro reservado (conteúdo oculto)
      </div>
    );
  }

  if (section.sectionType === "EVOLUCAO_SOAP") {
    return (
      <div className="rounded border p-3 space-y-2">
        <h3 className="font-medium">SOAP</h3>
        {(["subjective", "objective", "assessment", "plan"] as const).map(
          (key) => (
            <div key={key}>
              <Label>{key.toUpperCase()}</Label>
              <Textarea
                disabled={disabled}
                defaultValue={soap[key] ?? ""}
                onBlur={(e) =>
                  onSave(section.id, undefined, {
                    ...soap,
                    [key]: e.target.value,
                  })
                }
              />
            </div>
          ),
        )}
      </div>
    );
  }

  return (
    <div className="rounded border p-3 space-y-2">
      <h3 className="font-medium">{section.sectionType.replace(/_/g, " ")}</h3>
      <Textarea
        disabled={disabled}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => onSave(section.id, content)}
      />
    </div>
  );
}
