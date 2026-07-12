"use client";

import { useState, useTransition } from "react";
import type { AiResourceType } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  saveAiSettingsAction,
  grantAiConsentAction,
  simulateSecretaryAction,
  saveFaqAction,
} from "@/modules/ai/actions/ai.actions";

type SettingsData = Awaited<
  ReturnType<typeof import("@/modules/ai/actions/ai.actions").getAiSettingsAction>
>;

export function AiSettingsPanel({ initial }: { initial: SettingsData }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    (initial.settings?.enabledResources as Record<string, boolean>) ?? {},
  );
  const [phone, setPhone] = useState("11999990000");
  const [message, setMessage] = useState("Quero agendar uma consulta");
  const [chat, setChat] = useState<{ role: string; content: string }[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [faqQ, setFaqQ] = useState("");
  const [faqA, setFaqA] = useState("");
  const [discardAudio, setDiscardAudio] = useState(
    initial.settings?.discardAudioAfterTranscription ?? true,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const resources = Object.keys(initial.labels) as AiResourceType[];

  function toggleResource(r: AiResourceType) {
    setEnabled((prev) => ({ ...prev, [r]: !prev[r] }));
  }

  function saveSettings() {
    startTransition(async () => {
      const r = await saveAiSettingsAction({
        enabledResources: enabled,
        discardAudioAfterTranscription: discardAudio,
      });
      setMsg(r.success ? "Configurações salvas" : r.error ?? "Erro");
    });
  }

  function grantConsent(r: AiResourceType) {
    startTransition(async () => {
      const res = await grantAiConsentAction(r);
      setMsg(res.success ? `Consentimento registrado: ${initial.labels[r]}` : res.error ?? "Erro");
      if (res.success) window.location.reload();
    });
  }

  function simulate() {
    startTransition(async () => {
      const r = await simulateSecretaryAction({ phone, message, conversationId });
      if (r.success && r.data) {
        setChat((c) => [
          ...c,
          { role: "user", content: message },
          { role: "assistant", content: r.data!.reply },
        ]);
        setConversationId(r.data.conversationId);
        setMessage("");
      } else {
        setMsg(!r.success ? r.error : "Erro");
      }
    });
  }

  function addFaq() {
    startTransition(async () => {
      const r = await saveFaqAction({ question: faqQ, answer: faqA });
      setMsg(r.success ? "FAQ adicionada" : r.error ?? "Erro");
      if (r.success) {
        setFaqQ("");
        setFaqA("");
      }
    });
  }

  const consented = new Set(initial.consents.filter((c) => !c.revokedAt).map((c) => c.resource));

  return (
    <div className="space-y-8">
      {msg && <p className="rounded bg-zinc-100 px-3 py-2 text-sm">{msg}</p>}

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Uso mensal</h3>
        <p className="text-sm text-zinc-600">
          {initial.usage.tokensUsed.toLocaleString()} / {initial.usage.limit.toLocaleString()} tokens
          ({initial.usage.percentUsed}%)
          {initial.usage.alertAt80 && (
            <Badge className="ml-2" variant="outline">Alerta 80%</Badge>
          )}
        </p>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Recursos (ligar/desligar)</h3>
        <div className="flex flex-wrap gap-2">
          {resources.map((r) => (
            <Badge
              key={r}
              variant={enabled[r] ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleResource(r)}
            >
              {initial.labels[r]}
            </Badge>
          ))}
        </div>
        <Button onClick={saveSettings} disabled={pending}>Salvar recursos</Button>
        <label className="flex items-center gap-2 text-sm mt-2">
          <input
            type="checkbox"
            checked={discardAudio}
            onChange={(e) => setDiscardAudio(e.target.checked)}
          />
          Descartar áudio após transcrição (Scribe — padrão recomendado)
        </label>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Consentimento LGPD (OWNER)</h3>
        <p className="text-xs text-zinc-500">Termo v{initial.termVersion} — habilita fluxo de dados para provider externo após minimização.</p>
        <div className="flex flex-wrap gap-2">
          {resources.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={consented.has(r) ? "outline" : "default"}
              disabled={consented.has(r) || pending}
              onClick={() => grantConsent(r)}
            >
              {consented.has(r) ? "✓ " : ""}{initial.labels[r]}
            </Button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Simulador secretária virtual</h3>
        <div className="grid gap-2 max-w-lg">
          <Label>Telefone simulado</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Label>Mensagem</Label>
          <Input value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button onClick={simulate} disabled={pending}>Enviar</Button>
        </div>
        <div className="space-y-1 text-sm max-h-48 overflow-y-auto">
          {chat.map((m, i) => (
            <p key={i} className={m.role === "user" ? "text-blue-800" : "text-zinc-700"}>
              <strong>{m.role === "user" ? "Paciente" : "IA"}:</strong> {m.content}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">FAQ aprovadas</h3>
        <ul className="text-sm space-y-1">
          {initial.faqs.map((f) => (
            <li key={f.id}><strong>{f.question}</strong> — {f.answer.slice(0, 80)}…</li>
          ))}
        </ul>
        <div className="grid gap-2 max-w-lg">
          <Input placeholder="Pergunta" value={faqQ} onChange={(e) => setFaqQ(e.target.value)} />
          <Textarea placeholder="Resposta aprovada" value={faqA} onChange={(e) => setFaqA(e.target.value)} />
          <Button onClick={addFaq} disabled={pending || !faqQ || !faqA}>Adicionar FAQ</Button>
        </div>
      </section>
    </div>
  );
}
