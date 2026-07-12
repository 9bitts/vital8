"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/money";
import {
  createPayableAction,
  listPayablesAction,
  payPayableAction,
} from "@/modules/finance/actions/finance.actions";

export function PayablesPanel() {
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof listPayablesAction>>
  >([]);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState(0);
  const [, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      setItems(await listPayablesAction());
    });

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded border p-4 space-y-2 max-w-md">
        <h2 className="font-medium">Nova conta a pagar</h2>
        <Label>Descrição</Label>
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Label>Valor (centavos)</Label>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <Button
          onClick={() => {
            const today = new Date();
            startTransition(async () => {
              const r = await createPayableAction({
                description: desc,
                amountCents: amount,
                competenceDate: today,
                dueDate: today,
              });
              if (!r.success) alert(r.error);
              else {
                setDesc("");
                setAmount(0);
                load();
              }
            });
          }}
        >
          Salvar
        </Button>
      </div>

      <ul className="text-sm space-y-2">
        {items.map((p) => (
          <li key={p.id} className="flex justify-between rounded border p-2">
            <span>
              {p.description} — {formatBRL(p.amountCents)} — {p.status}
            </span>
            {p.status === "ABERTO" && (
              <Button
                size="sm"
                onClick={() =>
                  startTransition(async () => {
                    const r = await payPayableAction(p.id);
                    if (!r.success) alert(r.error);
                    else load();
                  })
                }
              >
                Baixar
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
