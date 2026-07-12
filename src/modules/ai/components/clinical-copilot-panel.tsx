"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  summarizeHistoryAction,
  structureSoapAction,
  suggestCidAction,
  recordAiOutcomeAction,
} from "@/modules/ai/actions/ai.actions";
import { AI_CLINICAL_FOOTER } from "@/modules/ai/lib/constants";

type Props = {
  patientId: string;
};

export function ClinicalCopilotPanel({ patientId }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLogId, setSummaryLogId] = useState<string | null>(null);
  const [dictation, setDictation] = useState("");
  const [soap, setSoap] = useState<Record<string, string> | null>(null);
  const [soapLogId, setSoapLogId] = useState<string | null>(null);
  const [cidHypothesis, setCidHypothesis] = useState("");
  const [cidSuggestions, setCidSuggestions] = useState<{ code: string; label: string }[]>([]);
  const [pending, startTransition] = useTransition();

  function summarize() {
    startTransition(async () => {
      const r = await summarizeHistoryAction(patientId);
      if (r.success && r.data) {
        setSummary(r.data.text);
        setSummaryLogId(r.data.logId);
      }
    });
  }

  function structureSoap() {
    startTransition(async () => {
      const r = await structureSoapAction(dictation);
      if (r.success && r.data) {
        try {
          setSoap(JSON.parse(r.data.text));
        } catch {
          setSoap({ subjective: r.data.text });
        }
        setSoapLogId(r.data.logId);
      }
    });
  }

  function suggestCid() {
    startTransition(async () => {
      const r = await suggestCidAction(cidHypothesis);
      if (r.success && r.data) setCidSuggestions(r.data.suggestions);
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

      <div className="space-y-2">
        <Button size="sm" variant="outline" onClick={summarize} disabled={pending}>
          Resumir histórico
        </Button>
        {summary && (
          <div className="rounded bg-white p-2 text-xs whitespace-pre-wrap border">
            <BadgeAi /> {summary}
            <div className="flex gap-1 mt-2">
              <Button size="sm" onClick={() => outcome(summaryLogId, "ACCEPTED")}>Aceitar</Button>
              <Button size="sm" variant="outline" onClick={() => outcome(summaryLogId, "REJECTED")}>Rejeitar</Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Textarea
          placeholder="Ditado / texto livre para estruturar SOAP…"
          value={dictation}
          onChange={(e) => setDictation(e.target.value)}
          rows={3}
        />
        <Button size="sm" variant="outline" onClick={structureSoap} disabled={pending || !dictation}>
          Estruturar SOAP
        </Button>
        {soap && (
          <div className="rounded bg-white p-2 text-xs space-y-1 border">
            <BadgeAi />
            {Object.entries(soap).map(([k, v]) => (
              <p key={k}><strong>{k}:</strong> {v}</p>
            ))}
            <p className="text-zinc-500 italic">Revise antes de salvar no prontuário.</p>
            <div className="flex gap-1">
              <Button size="sm" onClick={() => outcome(soapLogId, "EDITED")}>Salvar após revisão</Button>
              <Button size="sm" variant="outline" onClick={() => outcome(soapLogId, "REJECTED")}>Descartar</Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Textarea
          placeholder="Hipótese para sugestão CID-10…"
          value={cidHypothesis}
          onChange={(e) => setCidHypothesis(e.target.value)}
          rows={2}
        />
        <Button size="sm" variant="outline" onClick={suggestCid} disabled={pending || !cidHypothesis}>
          Sugerir CID-10
        </Button>
        {cidSuggestions.length > 0 && (
          <ul className="text-xs space-y-1">
            {cidSuggestions.map((c) => (
              <li key={c.code} className="rounded bg-white px-2 py-1 border">{c.code} — {c.label}</li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function BadgeAi() {
  return <span className="text-[10px] bg-violet-200 text-violet-800 px-1 rounded mr-1">IA</span>;
}
