"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { getNoShowRankingAction } from "@/modules/ai/actions/ai.actions";

export function NoShowRiskPanel() {
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof getNoShowRankingAction>>
  >([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        setRows(await getNoShowRankingAction());
      } catch {
        setRows([]);
      }
    });
  }, []);

  if (pending && rows.length === 0) return null;
  if (rows.length === 0) return null;

  const top = rows.filter((r) => r.risk.level !== "baixo").slice(0, 5);
  if (top.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
      <h3 className="text-sm font-medium text-amber-900">Risco de no-show (IA)</h3>
      <ul className="text-xs space-y-1">
        {top.map((r) => (
          <li key={r.appointmentId} className="flex justify-between gap-2">
            <span>
              {r.patientName} — {new Date(r.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <Badge variant={r.risk.level === "alto" ? "default" : "outline"}>
              {r.risk.score} ({r.risk.level})
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
