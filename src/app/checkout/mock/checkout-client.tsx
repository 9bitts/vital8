"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { completeMockCheckoutAction } from "@/modules/admin/actions/admin.actions";

export default function MockCheckoutClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const plan = (params.get("plan") ?? "PRO") as "BASICO" | "PRO" | "ENTERPRISE";
  const cycle = (params.get("cycle") ?? "MONTHLY") as "MONTHLY" | "ANNUAL";
  const returnUrl = params.get("return") ?? "/app/assinatura";

  return (
    <div className="mx-auto max-w-md mt-20 rounded border p-6 space-y-4">
      <h1 className="text-lg font-semibold">Checkout (mock)</h1>
      <p className="text-sm text-zinc-600">
        Simulação de pagamento — plano {plan} ({cycle}).
      </p>
      <Button
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await completeMockCheckoutAction(plan, cycle);
            router.push(returnUrl);
          })
        }
      >
        Confirmar pagamento fake
      </Button>
    </div>
  );
}
