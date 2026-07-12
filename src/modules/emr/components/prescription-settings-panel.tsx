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
import {
  getPrescriptionSettingsAction,
  savePrescriptionSettingsAction,
} from "@/modules/emr/actions/prescription.actions";
import { providerLabel } from "@/modules/emr/services/prescription-settings.service";

type Settings = Awaited<ReturnType<typeof getPrescriptionSettingsAction>>;

export function PrescriptionSettingsPanel({ initial }: { initial: Settings }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    provider: initial.provider,
    memedPartnerId: initial.memedPartnerId ?? "",
    memedApiKey: "",
    blockOnAllergyConflict: initial.blockOnAllergyConflict,
    blockOnDrugInteraction: initial.blockOnDrugInteraction,
    autoSendToPatient: initial.autoSendToPatient,
  });

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">Prescrição digital</h2>
        <p className="text-sm text-zinc-500">
          Provider Memed ou catálogo local, checagem de alergias/interações e envio ao paciente.
        </p>
      </div>

      <form
        className="grid gap-3 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await savePrescriptionSettingsAction({
              ...form,
              memedPartnerId: form.memedPartnerId || null,
              memedApiKey: form.memedApiKey || null,
            });
            setMessage(r.success ? "Salvo" : ("error" in r ? r.error : "Erro"));
          });
        }}
      >
        <div>
          <Label>Provedor de prescrição</Label>
          <Select
            value={form.provider}
            onValueChange={(v) => setForm({ ...form, provider: v as Settings["provider"] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["LOCAL", "MEMED"] as const).map((p) => (
                <SelectItem key={p} value={p}>{providerLabel(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {form.provider === "MEMED" && (
          <>
            <div>
              <Label>Partner ID Memed</Label>
              <Input
                value={form.memedPartnerId}
                onChange={(e) => setForm({ ...form, memedPartnerId: e.target.value })}
                placeholder="vital8-demo"
              />
            </div>
            <div>
              <Label>API Key Memed</Label>
              <Input
                type="password"
                value={form.memedApiKey}
                onChange={(e) => setForm({ ...form, memedApiKey: e.target.value })}
                placeholder={
                  initial.memedApiKeyEncrypted ? "já configurada — deixe vazio para manter" : ""
                }
              />
            </div>
          </>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.blockOnAllergyConflict}
            onChange={(e) =>
              setForm({ ...form, blockOnAllergyConflict: e.target.checked })
            }
          />
          Bloquear prescrição em conflito de alergia
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.blockOnDrugInteraction}
            onChange={(e) =>
              setForm({ ...form, blockOnDrugInteraction: e.target.checked })
            }
          />
          Bloquear prescrição em interação medicamentosa
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.autoSendToPatient}
            onChange={(e) => setForm({ ...form, autoSendToPatient: e.target.checked })}
          />
          Enviar receita automaticamente ao paciente (WhatsApp ou e-mail)
        </label>

        <Button type="submit" size="sm" disabled={pending}>Salvar prescrição</Button>
      </form>

      {message && <p className="text-sm text-green-700">{message}</p>}
    </div>
  );
}
