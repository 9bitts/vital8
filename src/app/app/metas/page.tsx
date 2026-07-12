"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getGoalProgressAction,
  listGoalsAction,
  saveGoalAction,
} from "@/modules/analytics/actions/analytics.actions";
import { formatBRL } from "@/lib/money";

export default function MetasPage() {
  const [goals, setGoals] = useState<Awaited<ReturnType<typeof listGoalsAction>>>([]);
  const [progress, setProgress] = useState<
    Record<string, Awaited<ReturnType<typeof getGoalProgressAction>>>
  >({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const g = await listGoalsAction();
      setGoals(g);
      const p: typeof progress = {};
      for (const goal of g) {
        p[goal.id] = await getGoalProgressAction(goal.id);
      }
      setProgress(p);
    });
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Metas mensais</h1>
      <form
        className="flex flex-wrap gap-2 rounded border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            await saveGoalAction({
              year: Number(fd.get("year")),
              month: Number(fd.get("month")),
              goalType: fd.get("goalType") as "REVENUE",
              targetValue: Number(fd.get("target")),
            });
            window.location.reload();
          });
        }}
      >
        <Input name="year" type="number" defaultValue={2026} className="w-24" />
        <Input name="month" type="number" defaultValue={7} min={1} max={12} className="w-20" />
        <select name="goalType" className="rounded border px-2">
          <option value="REVENUE">Receita</option>
          <option value="APPOINTMENTS">Atendimentos</option>
          <option value="NEW_PATIENTS">Novos pacientes</option>
          <option value="NPS">NPS</option>
        </select>
        <Input name="target" type="number" placeholder="Meta" required className="w-32" />
        <Button type="submit" disabled={pending}>Salvar meta</Button>
      </form>
      <ul className="space-y-3">
        {goals.map((g) => {
          const p = progress[g.id];
          const pct = p?.progressPct ?? 0;
          return (
            <li key={g.id} className="rounded border p-3">
              <div className="flex justify-between text-sm">
                <span>
                  {g.goalType} — {g.month}/{g.year}
                  {g.professional ? ` (${g.professional.displayName})` : " (org)"}
                </span>
                <span>{pct}%</span>
              </div>
              <div className="mt-2 h-2 rounded bg-zinc-100">
                <div
                  className={`h-2 rounded ${pct >= 100 ? "bg-green-600" : pct >= 80 ? "bg-amber-500" : "bg-blue-600"}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              {p && (
                <p className="text-xs text-zinc-500 mt-1">
                  Atual: {g.goalType === "REVENUE" ? formatBRL(p.current) : p.current} · Projeção:{" "}
                  {g.goalType === "REVENUE" ? formatBRL(p.projection) : p.projection}
                </p>
              )}
            </li>
          );
        })}
        {goals.length === 0 && <li className="text-sm text-zinc-500">Nenhuma meta configurada.</li>}
      </ul>
    </div>
  );
}
