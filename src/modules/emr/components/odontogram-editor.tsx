"use client";

import { useTransition } from "react";
import type { saveOdontogramEntryAction } from "@/modules/emr/actions/emr.actions";

const TEETH = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
];

type Entry = {
  id: string;
  toothFdi: number;
  face: string | null;
  finding: string | null;
  procedure: string | null;
};

type Props = {
  encounterId: string;
  entries: Entry[];
  onSave: typeof saveOdontogramEntryAction;
};

export function OdontogramEditor({ encounterId, entries, onSave }: Props) {
  const [pending, startTransition] = useTransition();

  function mark(tooth: number) {
    const finding = prompt(`Achado/procedimento dente ${tooth}:`);
    if (!finding) return;
    startTransition(async () => {
      await onSave({
        encounterId,
        toothFdi: tooth,
        finding,
        status: "PLANEJADO",
      });
    });
  }

  return (
    <div className="rounded border p-3">
      <h3 className="mb-2 font-medium">Odontograma (FDI)</h3>
      <svg viewBox="0 0 640 120" className="w-full max-w-2xl">
        {TEETH.map((tooth, i) => {
          const x = (i % 16) * 38 + 10;
          const y = i < 16 ? 10 : 60;
          const marked = entries.some((e) => e.toothFdi === tooth);
          return (
            <g key={tooth}>
              <rect
                x={x}
                y={y}
                width={32}
                height={40}
                rx={4}
                fill={marked ? "#FCA5A5" : "#E4E4E7"}
                stroke="#71717A"
                className="cursor-pointer"
                onClick={() => !pending && mark(tooth)}
              />
              <text x={x + 10} y={y + 24} fontSize={11}>
                {tooth}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 text-xs text-zinc-600">
        {entries.map((e) => (
          <li key={e.id}>
            Dente {e.toothFdi}: {e.finding ?? e.procedure}
          </li>
        ))}
      </ul>
    </div>
  );
}
