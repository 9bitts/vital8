"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  saveRndsCredentialAction,
  testRndsConnectionAction,
  saveInteropSettingsAction,
  retrySubmissionAction,
  manualReconcileAction,
  simulateLabFlowAction,
} from "../actions/interoperability.actions";
import { translateOperationOutcome } from "@/lib/integrations/rnds";

type Credential = {
  id: string;
  requesterId: string;
  environment: string;
  credentialStatus: string;
  certificateType: string;
  lastConnectionOk: boolean;
  branch: { name: string; cnes: string | null } | null;
};

type Submission = {
  id: string;
  registrationType: string;
  sourceType: string;
  sourceId: string;
  status: string;
  protocol: string | null;
  errorMessage: string | null;
  responseJson: unknown;
  attemptCount: number;
  createdAt: Date;
  credential: { environment: string; requesterId: string };
};

type Settings = {
  autoSendRac: boolean;
  autoSendExamResults: boolean;
  examResultDeadlineHours: number;
  labIntegrationEnabled: boolean;
  labPollingEnabled: boolean;
  labPollingIntervalMinutes: number;
};

type Reconciliation = {
  id: string;
  externalRequestId: string | null;
  ambiguityReason: string | null;
  createdAt: Date;
};

const STATUS_COLORS: Record<string, string> = {
  FILA: "bg-zinc-200",
  ENVIADO: "bg-blue-100",
  ACEITO: "bg-green-100",
  REJEITADO: "bg-red-100",
  ERRO: "bg-orange-100",
  DLQ: "bg-red-200",
};

export function InteroperabilityPanel({
  credentials,
  submissions,
  settings,
  reconciliations,
}: {
  credentials: Credential[];
  submissions: Submission[];
  settings: Settings;
  reconciliations: Reconciliation[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    requesterId: credentials[0]?.requesterId ?? "MOCK-SOLICITANTE-001",
    environment: "HOMOLOGACAO" as "HOMOLOGACAO" | "PRODUCAO",
    certificateType: "A1" as "A1" | "A3",
    certificateBase64: "MOCK-CERT-BASE64",
    credentialStatus: "HOMOLOGACAO" as "HOMOLOGACAO" | "PRODUCAO",
  });
  const [settingsForm, setSettingsForm] = useState(settings);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [manualRequestId, setManualRequestId] = useState("");
  const [selectedReconciliation, setSelectedReconciliation] = useState<string | null>(null);
  const [simulateRequestId, setSimulateRequestId] = useState("");

  function saveCredential() {
    startTransition(async () => {
      const result = await saveRndsCredentialAction(form);
      setMessage(result.success ? "Credencial salva" : result.error ?? "Erro");
    });
  }

  function testConnection(credentialId: string) {
    startTransition(async () => {
      const result = await testRndsConnectionAction(credentialId);
      if (result.success && result.data) {
        setMessage(result.data.message);
      } else if (!result.success) {
        setMessage(result.error ?? "Erro");
      }
    });
  }

  function saveSettings() {
    startTransition(async () => {
      const result = await saveInteropSettingsAction(settingsForm);
      setMessage(result.success ? "Regras de envio atualizadas" : result.error ?? "Erro");
    });
  }

  function retry(submissionId: string) {
    startTransition(async () => {
      const result = await retrySubmissionAction(submissionId);
      setMessage(result.success ? "Reenvio enfileirado" : result.error ?? "Erro");
    });
  }

  function reconcile() {
    if (!selectedReconciliation || !manualRequestId) return;
    startTransition(async () => {
      const result = await manualReconcileAction(selectedReconciliation, manualRequestId);
      setMessage(result.success ? "Conciliação manual concluída" : result.error ?? "Erro");
    });
  }

  function simulateLab() {
    startTransition(async () => {
      const result = await simulateLabFlowAction(simulateRequestId);
      setMessage(result.success ? "Fluxo laboratório simulado com sucesso" : result.error ?? "Erro");
    });
  }

  const filteredSubmissions =
    statusFilter === "all"
      ? submissions
      : submissions.filter((s) => s.status === statusFilter);

  function rejectionDetails(sub: Submission): string[] {
    if (sub.errorMessage) return [sub.errorMessage];
    if (sub.responseJson && typeof sub.responseJson === "object") {
      return translateOperationOutcome(sub.responseJson as Record<string, unknown>);
    }
    return [];
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm">{message}</p>
      )}

      <Tabs defaultValue="credential">
        <TabsList>
          <TabsTrigger value="credential">Credenciamento RNDS</TabsTrigger>
          <TabsTrigger value="rules">Regras de envio</TabsTrigger>
          <TabsTrigger value="monitor">Monitor de submissões</TabsTrigger>
          <TabsTrigger value="lab">Laboratórios</TabsTrigger>
        </TabsList>

        <TabsContent value="credential" className="space-y-4 pt-4">
          <div className="rounded-lg border p-4 space-y-3 max-w-xl">
            <h3 className="font-medium">Credencial RNDS (mock homologação)</h3>
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label>Identificador do solicitante</Label>
                <Input
                  value={form.requesterId}
                  onChange={(e) => setForm({ ...form, requesterId: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Ambiente</Label>
                <Select
                  value={form.environment}
                  onValueChange={(v) =>
                    setForm({ ...form, environment: v as "HOMOLOGACAO" | "PRODUCAO" })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOMOLOGACAO">Homologação</SelectItem>
                    <SelectItem value="PRODUCAO">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Certificado (A1 base64 mock)</Label>
                <Input
                  value={form.certificateBase64}
                  onChange={(e) => setForm({ ...form, certificateBase64: e.target.value })}
                />
              </div>
              <Button onClick={saveCredential} disabled={isPending}>
                Salvar credencial
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {credentials.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{c.requesterId}</p>
                  <p className="text-sm text-zinc-500">
                    {c.environment} · {c.credentialStatus}
                    {c.branch ? ` · ${c.branch.name} (CNES ${c.branch.cnes ?? "—"})` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={c.lastConnectionOk ? "bg-green-100" : "bg-zinc-100"}>
                    {c.lastConnectionOk ? "Conexão OK" : "Não testado"}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => testConnection(c.id)} disabled={isPending}>
                    Testar conexão
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4 pt-4 max-w-xl">
          <div className="rounded-lg border p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settingsForm.autoSendRac}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, autoSendRac: e.target.checked })
                }
              />
              Envio automático RAC ao assinar atendimento
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settingsForm.autoSendExamResults}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, autoSendExamResults: e.target.checked })
                }
              />
              Envio automático de resultados de exame (RNDS)
            </label>
            <div className="space-y-1">
              <Label>Prazo máximo para envio de resultados (horas)</Label>
              <Input
                type="number"
                value={settingsForm.examResultDeadlineHours}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    examResultDeadlineHours: parseInt(e.target.value, 10) || 24,
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settingsForm.labIntegrationEnabled}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, labIntegrationEnabled: e.target.checked })
                }
              />
              Integração com laboratórios habilitada
            </label>
            <Button onClick={saveSettings} disabled={isPending}>
              Salvar regras
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="monitor" className="space-y-4 pt-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="FILA">Fila</SelectItem>
              <SelectItem value="ACEITO">Aceito</SelectItem>
              <SelectItem value="REJEITADO">Rejeitado</SelectItem>
              <SelectItem value="DLQ">DLQ</SelectItem>
            </SelectContent>
          </Select>

          <div className="space-y-2">
            {filteredSubmissions.map((s) => (
              <div key={s.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {s.registrationType} · {s.sourceType}/{s.sourceId.slice(-8)}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {new Date(s.createdAt).toLocaleString("pt-BR")}
                      {s.protocol ? ` · Protocolo ${s.protocol}` : ""}
                    </p>
                  </div>
                  <Badge className={STATUS_COLORS[s.status] ?? "bg-zinc-100"}>{s.status}</Badge>
                </div>
                {s.status === "REJEITADO" && (
                  <div className="text-sm text-red-700 bg-red-50 rounded p-2">
                    {rejectionDetails(s).map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                )}
                {["REJEITADO", "ERRO", "DLQ"].includes(s.status) && (
                  <Button variant="outline" size="sm" onClick={() => retry(s.id)} disabled={isPending}>
                    Reenviar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="lab" className="space-y-4 pt-4">
          <div className="rounded-lg border p-4 space-y-3 max-w-xl">
            <h3 className="font-medium">Simulador de laboratório (dev)</h3>
            <div className="space-y-1">
              <Label>ID do pedido de exame (ExamRequest)</Label>
              <Input
                value={simulateRequestId}
                onChange={(e) => setSimulateRequestId(e.target.value)}
                placeholder="cuid do pedido"
              />
            </div>
            <Button onClick={simulateLab} disabled={isPending || !simulateRequestId}>
              Enviar pedido → receber resultado mock → conciliar
            </Button>
          </div>

          {reconciliations.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Fila de conciliação manual</h3>
              {reconciliations.map((r) => (
                <div key={r.id} className="rounded-lg border p-3 space-y-2">
                  <p className="text-sm">{r.ambiguityReason}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(r.createdAt).toLocaleString("pt-BR")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedReconciliation(r.id)}
                  >
                    Conciliar manualmente
                  </Button>
                </div>
              ))}
              {selectedReconciliation && (
                <div className="flex gap-2 items-end">
                  <div className="space-y-1 flex-1">
                    <Label>ID do pedido correto</Label>
                    <Input
                      value={manualRequestId}
                      onChange={(e) => setManualRequestId(e.target.value)}
                    />
                  </div>
                  <Button onClick={reconcile} disabled={isPending}>
                    Confirmar
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
