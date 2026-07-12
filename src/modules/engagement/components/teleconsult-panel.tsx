"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  createTeleconsultRoomAction,
  reportTeleconsultVideoIncidentAction,
} from "@/modules/engagement/actions/engagement.actions";
import { DailyEmbed, type DailyEmbedHandle } from "./daily-embed";

type Props = {
  encounterId: string;
  modality: string;
  disabled?: boolean;
};

type VideoCredentials = {
  provider: string;
  url: string;
  roomName: string;
  token?: string;
};

export function TeleconsultPanel({ encounterId, modality, disabled }: Props) {
  const embedRef = useRef<DailyEmbedHandle>(null);
  const [error, setError] = useState("");
  const [roomReady, setRoomReady] = useState(false);
  const [credentials, setCredentials] = useState<VideoCredentials | null>(null);
  const [inCall, setInCall] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (modality !== "TELECONSULTA") {
    return null;
  }

  function createRoom() {
    setError("");
    startTransition(async () => {
      try {
        await createTeleconsultRoomAction(encounterId);
        setRoomReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao criar sala");
      }
    });
  }

  function joinVideo() {
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/teleconsult/${encounterId}/video`);
        const data = (await res.json()) as VideoCredentials & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Falha ao obter credenciais");
        }
        setCredentials(data);
        setInCall(true);
        setRoomReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao entrar na sala");
      }
    });
  }

  function openExternal() {
    if (!credentials?.url) return;
    window.open(credentials.url, "_blank", "noopener,noreferrer");
  }

  async function leaveCall() {
    await embedRef.current?.leave();
    setInCall(false);
  }

  function reportIncident(kind: "audio_issue" | "video_issue" | "connection_lost") {
    startTransition(async () => {
      const r = await reportTeleconsultVideoIncidentAction({
        encounterId,
        kind,
      });
      if (!r.success) {
        setError(r.error);
      }
    });
  }

  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium text-sky-950">Teleconsulta</h2>
          <p className="text-sm text-sky-800">
            Sala privada com consentimento CFM registrado no prontuário.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!roomReady && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || isPending}
              onClick={createRoom}
            >
              {isPending ? "Criando…" : "Criar sala"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={disabled || isPending}
            onClick={joinVideo}
          >
            {isPending ? "Entrando…" : inCall ? "Atualizar credenciais" : "Entrar na videochamada"}
          </Button>
          {inCall && credentials?.provider === "daily" && (
            <Button type="button" size="sm" variant="outline" onClick={leaveCall}>
              Sair da chamada
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {credentials?.provider === "daily" && credentials.token && inCall && (
        <DailyEmbed
          ref={embedRef}
          url={credentials.url}
          token={credentials.token}
          onError={(msg) => setError(msg)}
        />
      )}

      {credentials?.provider === "jitsi" && credentials.url && (
        <div className="text-sm text-sky-900 space-y-2">
          <p>
            Modo desenvolvimento: sala Jitsi pública.{" "}
            <button type="button" className="underline" onClick={openExternal}>
              Abrir em nova aba
            </button>
          </p>
        </div>
      )}

      {inCall && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-sky-800">Reportar incidente:</span>
          <button
            type="button"
            className="underline text-sky-900"
            onClick={() => reportIncident("audio_issue")}
          >
            Áudio
          </button>
          <button
            type="button"
            className="underline text-sky-900"
            onClick={() => reportIncident("video_issue")}
          >
            Vídeo
          </button>
          <button
            type="button"
            className="underline text-sky-900"
            onClick={() => reportIncident("connection_lost")}
          >
            Conexão
          </button>
        </div>
      )}
    </section>
  );
}
