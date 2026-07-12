"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/money";
import {
  accrueCommissionAction,
  closeCommissionAction,
  listCommissionRulesAction,
} from "@/modules/finance/actions/finance.actions";

export function CommissionPanel() {
  const [rules, setRules] = useState<
    Awaited<ReturnType<typeof listCommissionRulesAction>>
  >([]);
  const [statement, setStatement] = useState<
    Awaited<ReturnType<typeof accrueCommissionAction>> | null
  >(null);
  const [profId, setProfId] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setRules(await listCommissionRulesAction());
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded border p-4 space-y-2">
        <h2 className="font-medium">Regras cadastradas</h2>
        <ul className="text-sm">
          {rules.map((r) => (
            <li key={r.id}>
              {r.professional.displayName} — {r.ruleType} {r.value} — base{" "}
              {r.base}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded border p-4 space-y-2 max-w-md">
        <h2 className="font-medium">Apurar período</h2>
        <Label>ID do profissional</Label>
        <Input value={profId} onChange={(e) => setProfId(e.target.value)} />
        <Button
          onClick={() => {
            const start = new Date();
            start.setDate(1);
            const end = new Date();
            startTransition(async () => {
              setStatement(
                await accrueCommissionAction({
                  professionalId: profId,
                  periodStart: start,
                  periodEnd: end,
                }),
              );
            });
          }}
        >
          Apurar
        </Button>
      </div>

      {statement && (
        <div className="rounded border p-4 space-y-2">
          <p>Total: {formatBRL(statement.totalCents)} — {statement.status}</p>
          <ul className="text-sm">
            {statement.items.map((i) => (
              <li key={i.id}>
                {i.description}: base {formatBRL(i.baseCents)} →{" "}
                {formatBRL(i.commissionCents)}
              </li>
            ))}
          </ul>
          {statement.status === "ABERTO" && (
            <Button
              onClick={() =>
                startTransition(async () => {
                  const r = await closeCommissionAction(statement.id);
                  if (!r.success) alert(r.error);
                })
              }
            >
              Fechar extrato
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
