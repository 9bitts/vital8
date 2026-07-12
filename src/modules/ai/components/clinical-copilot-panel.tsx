"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  summarizeHistoryAction,
  structureSoapAction,
  suggestCidFromAnamnesisAction,
  draftClinicalDocumentAction,
  recordAiOutcomeAction,
} from "@/modules/ai/actions/ai.actions";
import { AmbientScribePanel } from "@/modules/ai/components/ambient-scribe-panel";
import { AI_CLINICAL_FOOTER } from "@/modules/ai/lib/constants";

const SOAP_LABELS: Record<string, string> = {
  subjective: "Subjetivo (S)",
  objective: "Objetivo (O)",
  assessment: "Avaliação (A)",
  plan: "Plano (P)",
};

type Props = {
  patientId: string;
  encounterId: string;
  anamnesisText?: string;
  disabled?: boolean;
  onApplySoapField?: (field: string, value: string) => void;
};

export function ClinicalCopilotPanel({
  patientId,
  encounterId,
  anamnesisText,
  disabled,
  onApplySoapField,
}: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLogId, setSummaryLogId] = useState<string | null>(null);
  const [dictation, setDictation] = useState("");
  const [soap, setSoap] = useState<Record<string, string> | null>(null);
  const [soapLogId, setSoapLogId] = useState<string | null>(null);
  const [cidSuggestions, setCidSuggestions] = useState<{ code: string; label: string }[]>([]);
  const [cidLogId, setCidLogId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [draftLogId, setDraftLogId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [autoLoaded, setAutoLoaded] = useState(false);

  useEffect(() => {
    if (autoLoaded || disabled) return;
    setAutoLoaded(true);
    startTransition(async () => {
      const r = await summarizeHistoryAction(patientId);
      if (r.success && r.data) {
        setSummary(r.data.text);
        setSummaryLogId(r.data.logId);
      }
    });
  }, [patientId, disabled, autoLoaded]);

  function structureSoap() {
    startTransition(async () => {
      const r = await structureSoapAction(dictation);
      if (r.success && r.data) {
        try {
          setSoap(JSON.parse(r.data.text) as Record<string, string>);
        } catch {
          setSoap({ subjective: r.data.text });
        }
        setSoapLogId(r.data.logId);
      }
    });
  }

  function suggestCidFromAnamnesis() {
    const text = anamnesisText?.trim();
    if (!text) return;
    startTransition(async () => {
      const r = await suggestCidFromAnamnesisAction(text);
      if (r.success && r.data) {
        setCidSuggestions(r.data.suggestions);
        setCidLogId(r.data.logId);
      }
    });
  }

  function loadDraft(type: "certificate" | "referral" | "orientation") {
    startTransition(async () => {
      const r = await draftClinicalDocumentAction(encounterId, type);
      if (r.success && r.data) {
        setDraft(r.data.text);
        setDraftLogId(r.data.logId);
      }
    });
  }

  function outcome(logId: string | null, o: "ACCEPTED" | "EDITED" | "REJECTED") {
    if (!logId) return;
    startTransition(async () => {
      await recordAiOutcomeAction(logId, o);
    });
  }

  return (
    <aside className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 space-y-4 text-sm">
      <h3 className="font-semibold text-violet-900">Copiloto clínico (IA)</h3>
      <p className="text-xs text-violet-700">{AI_CLINICAL_FOOTER}</p>

      <AmbientScribePanel
        encounterId={encounterId}
        patientId={patientId}
        disabled={disabled}
        onApplySoapField={onApplySoapField}
      />

      {summary && (
        <div className="rounded bg-white p-2 text-xs whitespace-pre-wrap border">
          <BadgeAi /> <strong>Resumo do histórico</strong>
          <p className="mt-1">{summary}</p>
          <div className="flex gap-1 mt-2">
            <Button size="sm" onClick={() => outcome(summaryLogId, "ACCEPTED")}>
              Útil
            </Button>
            <Button size="sm" variant="outline" onClick={() => outcome(summaryLogId, "REJECTED")}>
              Descartar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Textarea
          placeholder="Ditado / texto livre para estruturar SOAP…"
          value={dictation}
          onChange={(e) => setDictation(e.target.value)}
          rows={3}
          disabled={disabled}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={structureSoap}
          disabled={pending || !dictation || disabled}
        >
          Estruturar SOAP
        </Button>
        {soap && (
          <div className="rounded bg-white p-2 text-xs space-y-2 border">
            <BadgeAi />
            {Object.entries(soap).map(([field, value]) => (
              <div key={field}>
                <p className="font-medium">{SOAP_LABELS[field] ?? field}</p>
                <p className="whitespace-pre-wrap">{value}</p>
                {onApplySoapField && !disabled && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1"
                    onClick={() => onApplySoapField(field, value)}
                  >
                    Aplicar {SOAP_LABELS[field] ?? field}
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-1">
              <Button size="sm" onClick={() => outcome(soapLogId, "EDITED")}>
                Revisado
              </Button>
              <Button size="sm" variant="outline" onClick={() => outcome(soapLogId, "REJECTED")}>
                Descartar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Button
          size="sm"
          variant="outline"
          onClick={suggestCidFromAnamnesis}
          disabled={pending || !anamnesisText?.trim() || disabled}
        >
          Sugerir CID-10 (anamnese)
        </Button>
        {cidSuggestions.length > 0 && (
          <ul className="text-xs space-y-1">
            <BadgeAi />
            {cidSuggestions.map((c) => (
              <li key={c.code} className="rounded bg-white px-2 py-1 border">
                {c.code} — {c.label}
              </li>
            ))}
            <Button size="sm" className="mt-1" onClick={() => outcome(cidLogId, "ACCEPTED")}>
              Aceitar sugestões
            </Button>
          </ul>
        )}
      </div>

      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => loadDraft("certificate")}>
            Rascunho atestado
          </Button>
          <Button size="sm" variant="outline" onClick={() => loadDraft("referral")}>
            Rascunho encaminhamento
          </Button>
        </div>
      )}

      {draft && (
        <div className="rounded bg-white border p-2 text-xs whitespace-pre-wrap">
          <BadgeAi /> {draft}
          <div className="flex gap-1 mt-2">
            <Button size="sm" onClick={() => outcome(draftLogId, "EDITED")}>
              Copiar após revisão
            </Button>
            <Button size="sm" variant="outline" onClick={() => outcome(draftLogId, "REJECTED")}>
              Descartar
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}

function BadgeAi() {
  return (
    <span className="text-[10px] bg-violet-200 text-violet-800 px-1 rounded mr-1">
      IA
    </span>
  );
}
