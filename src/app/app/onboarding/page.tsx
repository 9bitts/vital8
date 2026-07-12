"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  completeOnboardingStepAction,
  getOnboardingAction,
} from "@/modules/admin/actions/lifecycle.actions";

export default function OnboardingPage() {
  const [checklist, setChecklist] = useState<
    Awaited<ReturnType<typeof getOnboardingAction>>["checklist"]
  >([]);
  const [pending, startTransition] = useTransition();

  const reload = () =>
    startTransition(async () => {
      const r = await getOnboardingAction();
      setChecklist(r.checklist);
    });

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Onboarding</h1>
      <p className="text-sm text-zinc-600">Configure sua clínica passo a passo. Pode retomar a qualquer momento.</p>
      <ul className="space-y-2">
        {checklist.map((item) => (
          <li key={item.step} className="flex items-center justify-between rounded border p-3 text-sm">
            <span className={item.done ? "line-through text-zinc-400" : ""}>{item.label}</span>
            {!item.done && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await completeOnboardingStepAction(item.step);
                    reload();
                  })
                }
              >
                Concluir
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
