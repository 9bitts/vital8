"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  getSubscriptionAction,
  startCheckoutAction,
} from "@/modules/admin/actions/admin.actions";
import { formatBRL } from "@/lib/money";

export default function AssinaturaPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getSubscriptionAction>> | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setData(await getSubscriptionAction());
    });
  }, []);

  if (!data) return <p className="text-sm text-zinc-500">Carregando...</p>;

  const { subscription, usage, limits, pricing } = data;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Assinatura</h1>
      <div className="rounded border p-4 space-y-2 text-sm">
        <p>
          Plano: <strong>{subscription?.plan ?? "BASICO"}</strong> — {subscription?.status ?? "TRIAL"}
        </p>
        <p>Uso: {usage.users}/{limits.maxUsers} usuários · {usage.branches}/{limits.maxBranches} unidades · {usage.patients}/{limits.maxActivePatients} pacientes</p>
        <p>Valor: {formatBRL(pricing.monthly)}/mês</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["BASICO", "PRO", "ENTERPRISE"] as const).map((plan) => (
          <Button
            key={plan}
            size="sm"
            variant={subscription?.plan === plan ? "default" : "outline"}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await startCheckoutAction(plan, "MONTHLY");
                if (r.success && r.data?.checkoutUrl) {
                  window.location.href = r.data.checkoutUrl;
                }
              })
            }
          >
            {plan}
          </Button>
        ))}
      </div>
      {subscription?.status === "TRIAL" && subscription.trialEndsAt && (
        <p className="text-xs text-amber-700">
          Trial até {new Date(subscription.trialEndsAt).toLocaleDateString("pt-BR")}
        </p>
      )}
    </div>
  );
}
