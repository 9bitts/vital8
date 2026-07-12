"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/money";
import {
  checkoutAction,
  prepareCheckoutAction,
} from "@/modules/finance/actions/finance.actions";
import { previewConsumptionAction } from "@/modules/inventory/actions/inventory.actions";

type Props = {
  appointmentId: string;
  onDone?: () => void;
};

export function CheckoutDialog({ appointmentId, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<
    Awaited<ReturnType<typeof prepareCheckoutAction>> | null
  >(null);
  const [consumption, setConsumption] = useState<
    Awaited<ReturnType<typeof previewConsumptionAction>> | null
  >(null);
  const [discountCents, setDiscountCents] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [method, setMethod] = useState<
    "DINHEIRO" | "PIX" | "DEBITO" | "CREDITO"
  >("DINHEIRO");
  const [installments, setInstallments] = useState(1);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      try {
        setData(await prepareCheckoutAction(appointmentId));
        setConsumption(await previewConsumptionAction(appointmentId).catch(() => []));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro");
      }
    });
  }, [open, appointmentId]);

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Receber
      </Button>
    );
  }

  const item = data?.suggestedItem;
  const subtotal = item?.unitPriceCents ?? 0;
  const total = Math.max(0, subtotal - discountCents);
  const registerId = data?.openRegister?.id;
  const needsPayment = !data?.isInsurance || (data?.billableCents ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg space-y-3">
        <h3 className="font-semibold">Checkout</h3>
        {consumption && consumption.length > 0 && (
          <p className="text-sm text-zinc-700 rounded border p-2">
            Materiais consumidos (kit):{" "}
            {consumption.map((c) => `${c.quantity}× ${c.productName}`).join(", ")}
          </p>
        )}
        {data?.isInsurance && (
          <p className="text-sm text-blue-700 rounded border border-blue-200 bg-blue-50 p-2">
            Atendimento por convênio — faturamento via TISS.{" "}
            {data.coparticipationCents > 0
              ? `Coparticipação: ${formatBRL(data.coparticipationCents)}`
              : "Sem cobrança ao paciente."}
          </p>
        )}
        {!registerId && data?.isInsurance && data.billableCents === 0 && (
          <p className="text-sm text-zinc-600">Nenhum valor a receber no caixa.</p>
        )}
        {!registerId && !data?.isInsurance && (
          <p className="text-sm text-red-600">Abra o caixa antes de receber.</p>
        )}
        {item && (
          <div className="text-sm rounded border p-2">
            {item.description} — {formatBRL(item.unitPriceCents)}
          </div>
        )}
        <div>
          <Label>Desconto (centavos)</Label>
          <Input
            type="number"
            value={discountCents}
            onChange={(e) => setDiscountCents(Number(e.target.value))}
          />
        </div>
        {discountCents > 0 && (
          <div>
            <Label>Motivo do desconto</Label>
            <Input
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
            />
          </div>
        )}
        <div>
          <Label>Forma de pagamento</Label>
          <select
            className="w-full rounded border px-2 py-1"
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
          >
            <option value="DINHEIRO">Dinheiro</option>
            <option value="PIX">PIX</option>
            <option value="DEBITO">Débito</option>
            <option value="CREDITO">Crédito</option>
          </select>
        </div>
        <div>
          <Label>Parcelas (recebível)</Label>
          <Input
            type="number"
            min={1}
            value={installments}
            onChange={(e) => setInstallments(Number(e.target.value))}
          />
        </div>
        <p className="font-medium">Total: {formatBRL(total)}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={pending || !data || (needsPayment && !registerId)}
            onClick={() =>
              startTransition(async () => {
                if (!data) return;
                if (!needsPayment) {
                  setOpen(false);
                  onDone?.();
                  return;
                }
                if (!registerId || !item) return;
                const r = await checkoutAction({
                  appointmentId,
                  patientId: data.appointment.patientId,
                  professionalId: data.appointment.professionalId,
                  items: [item],
                  discountCents,
                  discountReason: discountReason || null,
                  paymentMethod: method,
                  installmentCount: installments,
                  cashRegisterId: registerId,
                  emitNfse: false,
                });
                      if (!r.success) {
                        setError("error" in r ? r.error : "Erro");
                        return;
                      }
                      alert(r.data!.receiptText);
                setOpen(false);
                onDone?.();
              })
            }
          >
            {needsPayment ? "Confirmar recebimento" : "Fechar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
