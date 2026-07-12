"use client";

import { useTransition } from "react";
import { updateLeadStatusAction } from "../actions/marketing.actions";
import type { LeadStatus } from "@/generated/prisma/client";

export type KanbanLead = {
  id: string;
  fullName: string;
  status: LeadStatus;
  phoneSearch: string | null;
  leadSource?: { name: string } | null;
  marketingCampaign?: { name: string } | null;
  createdAt: Date;
  lastContactAt: Date | null;
  lastStatusAt: Date;
};

const COLUMNS: { status: LeadStatus; label: string }[] = [
  { status: "NOVO", label: "Novo" },
  { status: "EM_CONTATO", label: "Em contato" },
  { status: "AGENDOU", label: "Agendou" },
  { status: "COMPARECEU", label: "Compareceu" },
  { status: "CONVERTIDO", label: "Convertido" },
  { status: "PERDIDO", label: "Perdido" },
];

function staleLabel(lead: KanbanLead): string | null {
  const ref = lead.lastContactAt ?? lead.createdAt;
  const hours = Math.floor((Date.now() - new Date(ref).getTime()) / 3_600_000);
  if (hours < 24 || ["CONVERTIDO", "PERDIDO", "COMPARECEU"].includes(lead.status)) return null;
  return `${hours}h parado`;
}

export function LeadKanban({ leads }: { leads: KanbanLead[] }) {
  const [, startTransition] = useTransition();

  function onDrop(status: LeadStatus, leadId: string) {
    startTransition(async () => {
      await updateLeadStatusAction({ leadId, status });
      window.location.reload();
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const items = leads.filter((l) => l.status === col.status);
        return (
          <section
            key={col.status}
            className="min-w-[220px] flex-1 rounded-lg border bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("leadId");
              if (id) onDrop(col.status, id);
            }}
          >
            <h3 className="mb-2 text-sm font-medium">
              {col.label} <span className="text-zinc-500">({items.length})</span>
            </h3>
            <ul className="space-y-2">
              {items.map((lead) => {
                const stale = staleLabel(lead);
                return (
                  <li
                    key={lead.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("leadId", lead.id)}
                    className="cursor-grab rounded-md border bg-white p-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <p className="font-medium">{lead.fullName}</p>
                    <p className="text-xs text-zinc-500">
                      {lead.leadSource?.name ?? "—"}
                      {lead.marketingCampaign ? ` · ${lead.marketingCampaign.name}` : ""}
                    </p>
                    {stale && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        ⚠ {stale}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
