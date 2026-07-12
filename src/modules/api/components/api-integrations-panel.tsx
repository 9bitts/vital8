"use client";

import { useState, useTransition } from "react";
import type { ApiClient, ApiKey, WebhookEndpoint } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createApiClientAction,
  createApiKeyAction,
  revokeApiKeyAction,
} from "@/modules/api/actions/api.actions";
import { API_SCOPES } from "@/modules/api/lib/scopes";

type ClientRow = ApiClient & {
  keys: ApiKey[];
  webhookEndpoints: WebhookEndpoint[];
  _count: { requestLogs: number };
};

const SCOPE_LABELS: Record<string, string> = {
  "patients:read": "Pacientes — leitura",
  "patients:write": "Pacientes — escrita",
  "appointments:read": "Agendamentos — leitura",
  "appointments:write": "Agendamentos — escrita",
  "schedule:read": "Agenda / disponibilidade",
  "encounters:read": "Atendimentos (conteúdo clínico requer habilitação OWNER)",
  "documents:read": "Documentos",
  "financial:read": "Financeiro — leitura",
  "financial:write": "Financeiro — escrita",
  "insurance:read": "Convênios",
  "stock:read": "Estoque",
  "webhooks:manage": "Webhooks",
};

export function ApiIntegrationsPanel({ clients }: { clients: ClientRow[] }) {
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"SANDBOX" | "PRODUCTION">("SANDBOX");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "patients:read",
    "appointments:read",
    "schedule:read",
  ]);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    window.location.reload();
  }

  function createClient() {
    startTransition(async () => {
      const result = await createApiClientAction({ name, environment });
      setMessage(result.success ? "Client criado" : result.error ?? "Erro");
      if (result.success) refresh();
    });
  }

  function createKey() {
    if (!selectedClient) return;
    startTransition(async () => {
      const result = await createApiKeyAction({
        apiClientId: selectedClient,
        scopes: selectedScopes as (typeof API_SCOPES)[number][],
      });
      if (result.success && result.data) {
        setNewToken(result.data.token);
        setMessage("Key criada — copie o secret agora (exibido uma única vez)");
        refresh();
      } else {
        setMessage(!result.success ? result.error : "Erro");
      }
    });
  }

  function revoke(keyId: string) {
    startTransition(async () => {
      const result = await revokeApiKeyAction(keyId);
      setMessage(result.success ? "Key revogada" : result.error ?? "Erro");
      if (result.success) refresh();
    });
  }

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  return (
    <div className="space-y-6">
      {message && <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm">{message}</p>}
      {newToken && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm break-all">
          <p className="font-medium text-amber-900">Secret (copie agora):</p>
          <code>{newToken}</code>
        </div>
      )}

      <div className="rounded-lg border p-4 space-y-3 max-w-xl">
        <h3 className="font-medium">Novo client de API</h3>
        <div className="space-y-2">
          <Label>Nome (ex.: parceiro de integração)</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="MeuApp" />
        </div>
        <Select value={environment} onValueChange={(v) => setEnvironment(v as typeof environment)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="SANDBOX">SANDBOX (org demo)</SelectItem>
            <SelectItem value="PRODUCTION">PRODUCTION</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={createClient} disabled={isPending || !name.trim()}>Criar client</Button>
      </div>

      <div className="rounded-lg border p-4 space-y-3 max-w-2xl">
        <h3 className="font-medium">Nova API key</h3>
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger><SelectValue placeholder="Selecione o client" /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name} ({c.environment})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2">
          {API_SCOPES.map((scope) => (
            <Badge
              key={scope}
              variant={selectedScopes.includes(scope) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleScope(scope)}
            >
              {SCOPE_LABELS[scope] ?? scope}
            </Badge>
          ))}
        </div>
        <Button onClick={createKey} disabled={isPending || !selectedClient}>Gerar key</Button>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium">Clients e keys</h3>
        {clients.map((c) => (
          <div key={c.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex justify-between">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-zinc-500">{c.environment} · {c._count.requestLogs} requisições logadas</p>
              </div>
              {c.clinicalAccessEnabled && <Badge>Acesso clínico</Badge>}
            </div>
            {c.keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between text-sm border-t pt-2">
                <div>
                  <code>{k.keyPrefix}</code>
                  <p className="text-zinc-500">{k.scopes.join(", ")}</p>
                  {k.revokedAt && <Badge variant="outline">Revogada</Badge>}
                </div>
                {!k.revokedAt && (
                  <Button variant="outline" size="sm" onClick={() => revoke(k.id)}>Revogar</Button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
