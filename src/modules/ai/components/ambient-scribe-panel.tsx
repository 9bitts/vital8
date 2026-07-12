"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  checkScribeConsentAction,
  getScribeSessionAction,
  processScribeAudioAction,
  recordScribeConsentAction,
  markScribeAppliedAction,
} from "@/modules/ai/actions/ai.actions";
import { AI_CLINICAL_FOOTER } from "@/modules/ai/lib/constants";

const SOAP_LABELS: Record<string, string> = {
  subjective: "Subjetivo (S)",
  objective: "Objetivo (O)",
  assessment: "Avaliação (A)",
  plan: "Plano (P)",
};

type Props = {
  encounterId: string;
  patientId: string;
  disabled?: boolean;
  onApplySoapField?: (field: string, value: string) => void;
  onApplied?: () => void;
};

export function AmbientScribePanel({
  encounterId,
  patientId,
  disabled,
  onApplySoapField,
  onApplied,
}: Props) {
  const [hasConsent, setHasConsent] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [soap, setSoap] = useState<Record<string, string> | null>(null);
  const [soapLogId, setSoapLogId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    checkScribeConsentAction(patientId).then(async (r) => {
      setHasConsent(r.hasConsent);
      if (r.hasConsent) {
        const session = await getScribeSessionAction(encounterId);
        if (session) setSessionId(session.id);
      }
    });
  }, [patientId, encounterId]);

  async function grantConsent() {
    startTransition(async () => {
      const r = await recordScribeConsentAction(encounterId, patientId);
      if (r.success && r.data) {
        setHasConsent(true);
        setSessionId(r.data.sessionId);
      } else if (!r.success) setError(r.error);
    });
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = String(reader.result ?? "").split(",")[1] ?? "";
          if (!sessionId) {
            setError("Sessão de scribe não iniciada");
            return;
          }
          startTransition(async () => {
            const r = await processScribeAudioAction(sessionId, base64);
            if (r.success && r.data) {
              setTranscript(r.data.transcript);
              setSoap(r.data.soap);
              setSoapLogId(r.data.soapLogId);
            } else if (!r.success) setError(r.error);
          });
        };
        reader.readAsDataURL(blob);
      };
      mediaRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microfone indisponível");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  if (disabled) return null;

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-2 text-sm">
      <h4 className="font-medium text-emerald-900">Scribe ambiente (áudio)</h4>
      <p className="text-xs text-emerald-800">{AI_CLINICAL_FOOTER}</p>

      {!hasConsent ? (
        <div className="space-y-2">
          <p className="text-xs">
            O paciente deve consentir com gravação para transcrição assistida por IA.
          </p>
          <Button size="sm" onClick={grantConsent} disabled={pending}>
            Registrar consentimento do paciente
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!recording ? (
            <Button size="sm" variant="outline" onClick={startRecording} disabled={pending}>
              Gravar consulta
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={stopRecording}>
              Parar gravação
            </Button>
          )}
        </div>
      )}

      {transcript && (
        <p className="text-xs rounded bg-white border p-2 whitespace-pre-wrap">
          <BadgeAi /> {transcript}
        </p>
      )}

      {soap && (
        <div className="space-y-2">
          {Object.entries(soap).map(([field, value]) => (
            <div key={field} className="rounded bg-white border p-2 text-xs">
              <p className="font-medium">{SOAP_LABELS[field] ?? field}</p>
              <p className="whitespace-pre-wrap">{value}</p>
              {onApplySoapField && (
                <Button
                  size="sm"
                  className="mt-1"
                  variant="outline"
                  onClick={() => onApplySoapField(field, value)}
                >
                  Aplicar no prontuário
                </Button>
              )}
            </div>
          ))}
          <Button
            size="sm"
            onClick={() =>
              startTransition(async () => {
                if (sessionId) {
                  await markScribeAppliedAction(sessionId, soapLogId ?? undefined);
                  onApplied?.();
                }
              })
            }
          >
            Marcar SOAP revisado
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function BadgeAi() {
  return (
    <span className="text-[10px] bg-violet-200 text-violet-800 px-1 rounded mr-1">
      IA
    </span>
  );
}
