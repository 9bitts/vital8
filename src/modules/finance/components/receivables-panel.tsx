"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import {
  listReceivablesAction,
  registerPaymentAction,
  runCollectionRemindersAction,
} from "@/modules/finance/actions/finance.actions";
import { getCashRegisterStateAction } from "@/modules/finance/actions/finance.actions";

export function ReceivablesPanel() {
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof listReceivablesAction>>
  >([]);
  const [registerId, setRegisterId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      setItems(await listReceivablesAction({}));
      const cash = await getCashRegisterStateAction();
      setRegisterId(cash.open?.id ?? null);
    });

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={load} disabled={pending}>
          Atualizar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            startTransition(async () => {
              const r = await runCollectionRemindersAction();
              alert(r.success ? `Enviados: ${r.data?.sent}` : r.error);
            })
          }
        >
          Régua de cobrança
        </Button>
      </div>
      <div className="rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="p-2 text-left">Paciente</th>
              <th className="p-2 text-left">Vencimento</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-right">Saldo</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">
                  {r.patient.socialName || r.patient.fullName}
                </td>
                <td className="p-2">
                  {new Date(r.dueDate).toLocaleDateString("pt-BR")}
                </td>
                <td className="p-2">{r.status}</td>
                <td className="p-2 text-right">
                  {formatBRL(r.totalCents - r.paidCents)}
                </td>
                <td className="p-2">
                  {registerId &&
                    r.status !== "PAGO" &&
                    r.status !== "CANCELADO" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          startTransition(async () => {
                            const amount = r.totalCents - r.paidCents;
                            const res = await registerPaymentAction({
                              receivableId: r.id,
                              amountCents: amount,
                              method: "DINHEIRO",
                              cashRegisterId: registerId,
                            });
                            if (!res.success) alert(res.error);
                            else load();
                          })
                        }
                      >
                        Baixar
                      </Button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
