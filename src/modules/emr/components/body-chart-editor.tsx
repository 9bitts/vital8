"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Entry = {
  id: string;
  x: number;
  y: number;
  label: string | null;
  note: string | null;
};

type Props = {
  encounterId: string;
  entries: Entry[];
  disabled?: boolean;
  onSave: (input: {
    encounterId: string;
    x: number;
    y: number;
    label?: string;
    note?: string;
  }) => Promise<{ success: boolean; error?: string }>;
};

export function BodyChartEditor({
  encounterId,
  entries,
  disabled,
  onSave,
}: Props) {
  const [pending, setPending] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [click, setClick] = useState<{ x: number; y: number } | null>(null);

  async function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (disabled || pending) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setClick({ x, y });
  }

  async function saveMark() {
    if (!click) return;
    setPending(true);
    await onSave({
      encounterId,
      x: click.x,
      y: click.y,
      label: draftNote || undefined,
      note: draftNote || undefined,
    });
    setPending(false);
    setClick(null);
    setDraftNote("");
  }

  return (
    <div className="rounded border p-3 space-y-2">
      <h3 className="font-medium">Mapa corporal</h3>
      <p className="text-xs text-zinc-500">
        Clique no diagrama para marcar ponto de dor/lesão.
      </p>
      <svg
        viewBox="0 0 100 200"
        className="mx-auto h-64 w-32 cursor-crosshair border bg-zinc-50"
        onClick={handleClick}
      >
        <ellipse cx="50" cy="25" rx="18" ry="22" fill="#e4e4e7" stroke="#71717a" />
        <rect x="35" y="45" width="30" height="55" rx="8" fill="#e4e4e7" stroke="#71717a" />
        <rect x="20" y="50" width="12" height="45" rx="4" fill="#e4e4e7" stroke="#71717a" />
        <rect x="68" y="50" width="12" height="45" rx="4" fill="#e4e4e7" stroke="#71717a" />
        <rect x="38" y="98" width="10" height="55" rx="4" fill="#e4e4e7" stroke="#71717a" />
        <rect x="52" y="98" width="10" height="55" rx="4" fill="#e4e4e7" stroke="#71717a" />
        {entries.map((entry) => (
          <circle
            key={entry.id}
            cx={entry.x}
            cy={(entry.y / 100) * 200}
            r="3"
            fill="#dc2626"
          />
        ))}
        {click && (
          <circle cx={click.x} cy={(click.y / 100) * 200} r="3" fill="#2563eb" />
        )}
      </svg>
      {click && !disabled && (
        <div className="flex gap-2">
          <Input
            placeholder="Anotação"
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
          />
          <Button size="sm" disabled={pending} onClick={saveMark}>
            Salvar marca
          </Button>
        </div>
      )}
    </div>
  );
}
