"use client";

import { useEffect, useState } from "react";
import { getEncounterAction } from "@/modules/emr/actions/emr.actions";

export function EncounterTimer({ encounterId }: { encounterId: string }) {
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    getEncounterAction(encounterId).then((d) => {
      const started =
        "encounter" in d && d.encounter?.startedAt
          ? new Date(d.encounter.startedAt)
          : null;
      setStartedAt(started);
    });
  }, [encounterId]);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div className="text-sm text-zinc-500">
      Tempo de atendimento:{" "}
      <span className="font-mono font-medium text-zinc-800">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  );
}
