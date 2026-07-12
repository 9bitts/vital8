"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/money";
import {
  cashMovementAction,
  closeCashRegisterAction,
  getCashRegisterStateAction,
  openCashRegisterAction,
} from "@/modules/finance/actions/finance.actions";

export function CashRegisterPanel() {
  const [state, setState] = useState<
    Awaited<ReturnType<typeof getCashRegisterStateAction>> | null
  >(null);
  const [opening, setOpening] = useState(0);
  const [counted, setCounted] = useState(0);
  const [movementAmount, setMovementAmount] = useState(0);
  const [movementReason, setMovementReason] = useState("");
  const [pending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      setState(await getCashRegisterStateAction());
    });

  useEffect(() => {
    load();
  }, []);

  const open = state?.open;

  return (
    <div className="space-y-4">
      {!open ? (
        <div className="rounded border p-4 space-y-2 max-w-sm">
          <h2 className="font-medium">Abrir caixa</h2>
          <Label>Fundo de troco (centavos)</Label>
          <Input
            type="number"
            value={opening}
            onChange={(e) => setOpening(Number(e.target.value))}
          />
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await openCashRegisterAction({
                  openingAmountCents: opening,
                });
                if (!r.success) alert(r.error);
                else load();
              })
            }
          >
            Abrir caixa
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded border p-4">
            <h2 className="font-medium">Caixa aberto</h2>
            <p className="text-sm text-zinc-500">
              Fundo: {formatBRL(open.openingAmountCents)}
            </p>
            <ul className="mt-2 text-sm max-h-48 overflow-auto">
              {open.entries.map((e) => (
                <li key={e.id}>
                  {e.entryType} {formatBRL(e.amountCents)}{" "}
                  {e.reason ? `— ${e.reason}` : ""}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded border p-4 space-y-2">
              <h3 className="font-medium">Sangria / Reforço</h3>
              <Input
                type="number"
                placeholder="Valor (centavos)"
                value={movementAmount}
                onChange={(e) => setMovementAmount(Number(e.target.value))}
              />
              <Input
                placeholder="Motivo"
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await cashMovementAction({
                        cashRegisterId: open.id,
                        entryType: "SANGRIA",
                        amountCents: movementAmount,
                        reason: movementReason,
                      });
                      if (!r.success) alert(r.error);
                      else load();
                    })
                  }
                >
                  Sangria
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await cashMovementAction({
                        cashRegisterId: open.id,
                        entryType: "REFORCO",
                        amountCents: movementAmount,
                        reason: movementReason,
                      });
                      if (!r.success) alert(r.error);
                      else load();
                    })
                  }
                >
                  Reforço
                </Button>
              </div>
            </div>

            <div className="rounded border p-4 space-y-2">
              <h3 className="font-medium">Fechamento cego</h3>
              <Label>Valor contado (centavos)</Label>
              <Input
                type="number"
                value={counted}
                onChange={(e) => setCounted(Number(e.target.value))}
              />
              <Button
                onClick={() =>
                  startTransition(async () => {
                    const r = await closeCashRegisterAction({
                      cashRegisterId: open.id,
                      countedCents: counted,
                    });
                    if (!r.success) alert(r.error);
                    else {
                      alert(
                        `Diferença: ${formatBRL(r.data?.differenceCents ?? 0)}`,
                      );
                      load();
                    }
                  })
                }
              >
                Fechar caixa
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="rounded border p-4">
        <h2 className="font-medium mb-2">Histórico</h2>
        <ul className="text-sm space-y-1">
          {(state?.history ?? []).map((h) => (
            <li key={h.id}>
              {h.openedAt.toLocaleDateString("pt-BR")} — {h.status}
              {h.closingDifferenceCents != null &&
                ` — dif: ${formatBRL(h.closingDifferenceCents)}`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
