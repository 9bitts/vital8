"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/money";
import {
  appealGlosaAction,
  resolveGlosaAction,
} from "@/modules/tiss/actions/tiss.actions";
import { draftGlosaAppealAction } from "@/modules/ai/actions/ai.actions";

type Glosa = Awaited<
  ReturnType<typeof import("@/modules/tiss/actions/tiss.actions").listGlosasAction>
>[number];

type Props = {
  items: Glosa[];
};

export function GlosasPanel({ items }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-4">
      {items.map((g) => (
        <div key={g.id} className="rounded border p-3 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="font-medium">
              Guia #{g.tissGuide.guideNumber} — {g.tissGuide.appointment.patient.fullName}
            </span>
            <Badge>{g.status}</Badge>
          </div>
          <div>{g.reasonCode.code} — {g.reasonCode.description}</div>
          <div>Valor glosado: {formatBRL(g.glosedAmountCents)}</div>
          {g.status === "ACEITA" && (
            <form
              className="flex flex-wrap gap-2 items-end"
              id={`glosa-form-${g.id}`}
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  const r = await appealGlosaAction({
                    glosaItemId: g.id,
                    justification: fd.get("justification"),
                    appealDeadline: fd.get("appealDeadline"),
                  });
                  setMessage(r.success ? "Recurso iniciado" : ("error" in r ? r.error : "Erro"));
                });
              }}
            >
              <div className="flex-1">
                <Label>Justificativa</Label>
                <Input name="justification" required minLength={10} id={`just-${g.id}`} />
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await draftGlosaAppealAction({
                      reasonCode: g.reasonCode.code,
                      reasonDescription: g.reasonCode.description,
                      glosedAmountCents: g.glosedAmountCents,
                      guideNumber: String(g.tissGuide.guideNumber),
                    });
                    if (r.success && r.data) {
                      const input = document.getElementById(`just-${g.id}`) as HTMLInputElement;
                      if (input) input.value = r.data.text;
                      setMessage("Rascunho IA — revise antes de enviar");
                    } else {
                      setMessage(!r.success ? r.error : "Erro");
                    }
                  })
                }
              >
                Rascunho IA
              </Button>
              <div>
                <Label>Prazo</Label>
                <Input name="appealDeadline" type="date" required />
              </div>
              <Button type="submit" size="sm" disabled={pending}>Iniciar recurso</Button>
            </form>
          )}
          {g.status === "EM_RECURSO" && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  startTransition(async () => {
                    await resolveGlosaAction(g.id, "RECUPERADA");
                    setMessage("Glosa recuperada");
                  })
                }
              >
                Recuperada
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  startTransition(async () => {
                    await resolveGlosaAction(g.id, "PERDIDA");
                    setMessage("Glosa perdida");
                  })
                }
              >
                Perdida
              </Button>
            </div>
          )}
          {g.appealJustification && (
            <p className="text-zinc-600">Recurso: {g.appealJustification}</p>
          )}
        </div>
      ))}
      {message && <p className="text-sm text-green-700">{message}</p>}
    </div>
  );
}
