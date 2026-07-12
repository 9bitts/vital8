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
import { saveFiscalSettingsAction } from "@/modules/finance/actions/fiscal.actions";

type Settings = Awaited<
  ReturnType<typeof import("@/modules/finance/actions/fiscal.actions").getFiscalSettingsAction>
>;

type Props = { initial: Settings };

export function FiscalSettingsPanel({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    taxRegime: initial.taxRegime,
    cnae: initial.cnae ?? "",
    nacionalServiceCode: initial.nacionalServiceCode ?? "",
    issRateBasisPoints: initial.issRateBasisPoints,
    nfseProvider: initial.nfseProvider,
    autoEmitOnPayment: initial.autoEmitOnPayment,
    emitProfile: initial.emitProfile,
    municipioIbgeCode: initial.municipioIbgeCode ?? "",
    inscricaoMunicipal: initial.inscricaoMunicipal ?? "",
    cbsIbsEnabled: initial.cbsIbsEnabled,
    cbsRateBasisPoints: initial.cbsRateBasisPoints ?? 0,
    ibsRateBasisPoints: initial.ibsRateBasisPoints ?? 0,
    certificateBase64: "",
    certificatePassword: "",
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">NFS-e Padrão Nacional — obrigatório desde jan/2026</p>
        <p className="mt-1">
          Configure o provedor <strong>nfse-nacional</strong> em produção com certificado A1.
          Em desenvolvimento, o adapter <strong>mock</strong> é usado por padrão.
        </p>
      </div>

      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await saveFiscalSettingsAction({
              ...form,
              cnae: form.cnae || null,
              nacionalServiceCode: form.nacionalServiceCode || null,
              municipioIbgeCode: form.municipioIbgeCode || null,
              inscricaoMunicipal: form.inscricaoMunicipal || null,
              certificateBase64: form.certificateBase64 || null,
              certificatePassword: form.certificatePassword || null,
            });
            setMessage(r.success ? "Configurações salvas" : ("error" in r ? r.error : "Erro"));
          });
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Regime tributário</Label>
            <Select
              value={form.taxRegime}
              onValueChange={(v) => setForm({ ...form, taxRegime: v as Settings["taxRegime"] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SIMPLES_NACIONAL">Simples Nacional</SelectItem>
                <SelectItem value="MEI">MEI</SelectItem>
                <SelectItem value="LUCRO_PRESUMIDO">Lucro Presumido</SelectItem>
                <SelectItem value="LUCRO_REAL">Lucro Real</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Provedor NFS-e</Label>
            <Select
              value={form.nfseProvider}
              onValueChange={(v) => setForm({ ...form, nfseProvider: v as Settings["nfseProvider"] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MOCK">Mock (dev)</SelectItem>
                <SelectItem value="NFSE_NACIONAL">Portal Nacional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>CNAE</Label>
            <Input value={form.cnae} onChange={(e) => setForm({ ...form, cnae: e.target.value })} />
          </div>
          <div>
            <Label>Código serviço nacional (LC 214)</Label>
            <Input
              value={form.nacionalServiceCode}
              onChange={(e) => setForm({ ...form, nacionalServiceCode: e.target.value })}
              placeholder="040101"
            />
          </div>
          <div>
            <Label>Alíquota ISS (bps)</Label>
            <Input
              type="number"
              value={form.issRateBasisPoints}
              onChange={(e) =>
                setForm({ ...form, issRateBasisPoints: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Perfil de emissão</Label>
            <Select
              value={form.emitProfile}
              onValueChange={(v) => setForm({ ...form, emitProfile: v as Settings["emitProfile"] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Automático (PJ=NFS-e, PF=Receita Saúde)</SelectItem>
                <SelectItem value="NFSE_ONLY">Somente NFS-e</SelectItem>
                <SelectItem value="RECEITA_SAUDE_ONLY">Somente Receita Saúde</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Município IBGE</Label>
            <Input
              value={form.municipioIbgeCode}
              onChange={(e) => setForm({ ...form, municipioIbgeCode: e.target.value })}
            />
          </div>
          <div>
            <Label>Inscrição municipal</Label>
            <Input
              value={form.inscricaoMunicipal}
              onChange={(e) => setForm({ ...form, inscricaoMunicipal: e.target.value })}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.autoEmitOnPayment}
            onChange={(e) => setForm({ ...form, autoEmitOnPayment: e.target.checked })}
          />
          Emitir automaticamente ao quitar recebível
        </label>

        <div className="rounded border p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.cbsIbsEnabled}
              onChange={(e) => setForm({ ...form, cbsIbsEnabled: e.target.checked })}
            />
            Reforma tributária (CBS/IBS) — feature flag
          </label>
          {form.cbsIbsEnabled && (
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <Label>Alíquota CBS (bps)</Label>
                <Input
                  type="number"
                  value={form.cbsRateBasisPoints}
                  onChange={(e) =>
                    setForm({ ...form, cbsRateBasisPoints: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Alíquota IBS (bps)</Label>
                <Input
                  type="number"
                  value={form.ibsRateBasisPoints}
                  onChange={(e) =>
                    setForm({ ...form, ibsRateBasisPoints: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          )}
        </div>

        <div className="rounded border p-4 space-y-3">
          <p className="text-sm font-medium">Certificado A1 (PFX em base64)</p>
          <p className="text-xs text-zinc-500">
            Atual: {initial.certificateEncrypted ? "configurado" : "não configurado"}
          </p>
          <textarea
            className="w-full rounded border p-2 text-xs font-mono"
            rows={3}
            placeholder="Cole o PFX em base64 para atualizar"
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

        <Button type="submit" disabled={pending}>Salvar configurações fiscais</Button>
      </form>

      {message && <p className="text-sm text-green-700">{message}</p>}
    </div>
  );
}
