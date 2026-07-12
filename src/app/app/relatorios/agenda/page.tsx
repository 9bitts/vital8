"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getNoShowReportAction,
  getOccupationReportAction,
  getOriginReportAction,
} from "@/modules/scheduling/actions/report.actions";

export default function AgendaReportsPage() {
  const [start, setStart] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30))
      .toISOString()
      .slice(0, 10),
  );
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [occupation, setOccupation] = useState<
    Awaited<ReturnType<typeof getOccupationReportAction>>
  >([]);
  const [noShow, setNoShow] = useState<
    Awaited<ReturnType<typeof getNoShowReportAction>> | null
  >(null);
  const [origin, setOrigin] = useState<
    Awaited<ReturnType<typeof getOriginReportAction>>
  >([]);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const s = new Date(start);
      const e = new Date(end);
      e.setHours(23, 59, 59, 999);
      const [occ, ns, orig] = await Promise.all([
        getOccupationReportAction({ start: s, end: e }),
        getNoShowReportAction({ start: s, end: e }),
        getOriginReportAction({ start: s, end: e }),
      ]);
      setOccupation(occ);
      setNoShow(ns);
      setOrigin(orig);
    });
  }, [start, end]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios da agenda</h1>
        <p className="text-sm text-zinc-500">
          Ocupação, no-show e origem dos agendamentos
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label>Início</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <Label>Fim</Label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <Button onClick={load} disabled={pending}>
          Atualizar
        </Button>
      </div>

      <section>
        <h2 className="mb-2 font-medium">Ocupação por profissional</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Profissional</th>
              <th className="p-2">Ocupados</th>
              <th className="p-2">Disponíveis</th>
              <th className="p-2">Taxa</th>
            </tr>
          </thead>
          <tbody>
            {occupation.map((o) => (
              <tr key={o.professionalId} className="border-b">
                <td className="p-2">{o.professionalName}</td>
                <td className="p-2">{o.occupiedSlots}</td>
                <td className="p-2">{o.availableSlots}</td>
                <td className="p-2">{o.occupationRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {noShow && (
        <>
          <section>
            <h2 className="mb-2 font-medium">No-show por profissional</h2>
            <ul className="text-sm">
              {noShow.byProfessional.map((r) => (
                <li key={r.professionalId}>
                  {r.professionalName}: {r.noShows}/{r.total} ({r.rate}%)
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 font-medium">No-show por dia da semana</h2>
            <ul className="text-sm">
              {noShow.byWeekday.map((r) => (
                <li key={r.weekday}>
                  {r.weekday}: {r.noShows}/{r.total} ({r.rate}%)
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section>
        <h2 className="mb-2 font-medium">Atendimentos por origem</h2>
        <ul className="text-sm">
          {origin.map((o) => (
            <li key={o.origin}>
              {o.label}: {o.count}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
