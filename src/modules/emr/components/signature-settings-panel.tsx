"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveSignatureSettingsAction } from "@/modules/emr/actions/signature.actions";
import { providerLabel } from "@/modules/emr/services/signature-settings.service";

type Settings = Awaited<
  ReturnType<typeof import("@/modules/emr/actions/signature.actions").getSignatureSettingsAction>
>;

export function SignatureSettingsPanel({ initial }: { initial: Settings }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    provider: initial.provider,
    timestampEnabled: initial.timestampEnabled,
    dsasApiUrl: initial.dsasApiUrl ?? "",
    certificateBase64: "",
    certificatePassword: "",
    dsasApiKey: "",
  });

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">Assinatura digital ICP-Brasil</h2>
        <p className="text-sm text-zinc-500">
          A1 no servidor, DSaS via API, Lacuna (BirdID/VIDaaS) ou mock em desenvolvimento.
        </p>
      </div>

      <form
        className="grid gap-3 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await saveSignatureSettingsAction({
              ...form,
              dsasApiUrl: form.dsasApiUrl || null,
              certificateBase64: form.certificateBase64 || null,
              certificatePassword: form.certificatePassword || null,
              dsasApiKey: form.dsasApiKey || null,
            });
            setMessage(r.success ? "Salvo" : ("error" in r ? r.error : "Erro"));
          });
        }}
      >
        <div>
          <Label>Provedor</Label>
          <Select
            value={form.provider}
            onValueChange={(v) => setForm({ ...form, provider: v as Settings["provider"] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["DEV_SIMPLE", "ICP_A1", "ICP_DSAS", "ICP_LACUNA"] as const).map((p) => (
                <SelectItem key={p} value={p}>{providerLabel(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.timestampEnabled}
            onChange={(e) => setForm({ ...form, timestampEnabled: e.target.checked })}
          />
          Carimbo de tempo (ACT/ITI)
        </label>

        {form.provider === "ICP_DSAS" && (
          <>
            <div>
              <Label>URL API DSaS</Label>
              <Input
                value={form.dsasApiUrl}
                onChange={(e) => setForm({ ...form, dsasApiUrl: e.target.value })}
                placeholder="https://api.certisign.com.br/v1"
              />
            </div>
            <div>
              <Label>API Key DSaS</Label>
              <Input
                type="password"
                value={form.dsasApiKey}
                onChange={(e) => setForm({ ...form, dsasApiKey: e.target.value })}
              />
            </div>
          </>
        )}

        {form.provider === "ICP_A1" && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">
              Certificado atual: {initial.certificateEncrypted ? "configurado" : "não configurado"}
            </p>
            <textarea
              className="w-full rounded border p-2 text-xs font-mono"
              rows={2}
              placeholder="PFX base64"
              value={form.certificateBase64}
              onChange={(e) => setForm({ ...form, certificateBase64: e.target.value })}
            />
            <Input
              type="password"
              placeholder="Senha do certificado"
              value={form.certificatePassword}
              onChange={(e) => setForm({ ...form, certificatePassword: e.target.value })}
            />
          </div>
        )}

        {form.provider === "ICP_LACUNA" && (
          <div className="space-y-2 text-sm text-zinc-600">
            <p>
              Fluxo redirect: profissional assina na Lacuna (BirdID/VIDaaS). Configure{" "}
              <code className="text-xs">LACUNA_API_KEY</code> no servidor.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const res = await fetch("/api/digital-sign/test", { method: "POST" });
                  const data = (await res.json()) as {
                    redirectUrl?: string;
                    error?: string;
                  };
                  if (data.redirectUrl) {
                    window.location.href = data.redirectUrl;
                  } else {
                    setMessage(data.error ?? "Falha no teste Lacuna");
                  }
                });
              }}
            >
              Testar assinatura Lacuna
            </Button>
          </div>
        )}

        <Button type="submit" size="sm" disabled={pending}>Salvar assinatura</Button>
      </form>

      {message && <p className="text-sm text-green-700">{message}</p>}
    </div>
  );
}
