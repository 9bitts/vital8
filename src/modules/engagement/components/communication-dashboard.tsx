"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  processQueueAction,
  retryCommunicationAction,
} from "@/modules/engagement/actions/engagement.actions";

type Log = Awaited<
  ReturnType<typeof import("@/modules/engagement/actions/engagement.actions").listCommunicationsAction>
>[number];

type Props = { logs: Log[] };

export function CommunicationDashboard({ logs }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await processQueueAction();
              window.location.reload();
            })
          }
        >
          Processar fila (dev)
        </Button>
      </div>
      <ul className="space-y-2">
        {logs.map((log) => (
          <li key={log.id} className="rounded border p-3 text-sm">
            <div className="flex justify-between">
              <span>{log.patient.fullName}</span>
              <Badge>{log.status}</Badge>
            </div>
            <p className="text-zinc-500">{log.origin} · {log.channel}</p>
            <p className="truncate">{log.renderedBody.slice(0, 120)}…</p>
            {log.status === "FALHA" && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() =>
                  startTransition(async () => {
                    await retryCommunicationAction(log.id);
                    window.location.reload();
                  })
                }
              >
                Reenviar
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
