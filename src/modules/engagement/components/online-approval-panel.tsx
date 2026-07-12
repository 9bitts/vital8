"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  approveOnlineAction,
  rejectOnlineAction,
} from "@/modules/engagement/actions/engagement.actions";

type Appt = Awaited<
  ReturnType<typeof import("@/modules/engagement/actions/engagement.actions").listPendingOnlineAction>
>[number];

type Props = { appointments: Appt[] };

export function OnlineApprovalPanel({ appointments }: Props) {
  const [pending, startTransition] = useTransition();

  if (appointments.length === 0) {
    return <p className="text-sm text-zinc-500">Nenhum agendamento pendente.</p>;
  }

  return (
    <ul className="space-y-2">
      {appointments.map((a) => (
        <li key={a.id} className="rounded border p-3 text-sm flex justify-between items-center">
          <div>
            <p className="font-medium">{a.patient.fullName}</p>
            <p>
              {a.startsAt.toLocaleString("pt-BR")} — {a.service.name} com{" "}
              {a.professional.displayName}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await approveOnlineAction(a.id);
                  window.location.reload();
                })
              }
            >
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await rejectOnlineAction(a.id);
                  window.location.reload();
                })
              }
            >
              Rejeitar
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
