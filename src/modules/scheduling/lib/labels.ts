import type { AppointmentStatus } from "@/generated/prisma/client";

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  AGENDADO: "Agendado",
  CONFIRMADO: "Confirmado",
  AGUARDANDO: "Aguardando",
  EM_ATENDIMENTO: "Em atendimento",
  FINALIZADO: "Finalizado",
  FALTOU: "Faltou",
  CANCELADO: "Cancelado",
  REMARCADO: "Remarcado",
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  AGENDADO: "bg-blue-100 border-blue-300 text-blue-900",
  CONFIRMADO: "bg-emerald-100 border-emerald-300 text-emerald-900",
  AGUARDANDO: "bg-amber-100 border-amber-300 text-amber-900",
  EM_ATENDIMENTO: "bg-violet-100 border-violet-300 text-violet-900",
  FINALIZADO: "bg-zinc-100 border-zinc-300 text-zinc-700",
  FALTOU: "bg-red-100 border-red-300 text-red-900",
  CANCELADO: "bg-zinc-200 border-zinc-400 text-zinc-500 line-through",
  REMARCADO: "bg-orange-100 border-orange-300 text-orange-900",
};

export function formatDisplayName(fullName: string, socialName?: string | null): string {
  const name = socialName?.trim() || fullName.trim();
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() ?? "";
  return `${first} ${lastInitial}.`;
}

export function formatPanelName(fullName: string, socialName?: string | null): string {
  return formatDisplayName(fullName, socialName);
}

export type OrgSchedulingSettings = {
  receptionWaitLimitMinutes?: number;
  professionalCanViewOthers?: boolean;
};

export function parseOrgSettings(raw: unknown): OrgSchedulingSettings {
  if (!raw || typeof raw !== "object") return {};
  const s = raw as Record<string, unknown>;
  return {
    receptionWaitLimitMinutes:
      typeof s.receptionWaitLimitMinutes === "number"
        ? s.receptionWaitLimitMinutes
        : 30,
    professionalCanViewOthers:
      typeof s.professionalCanViewOthers === "boolean"
        ? s.professionalCanViewOthers
        : true,
  };
}

export const BRAZIL_NATIONAL_HOLIDAYS_2026: { date: string; name: string }[] = [
  { date: "2026-01-01", name: "Confraternização Universal" },
  { date: "2026-02-16", name: "Carnaval" },
  { date: "2026-02-17", name: "Carnaval" },
  { date: "2026-04-03", name: "Sexta-feira Santa" },
  { date: "2026-04-21", name: "Tiradentes" },
  { date: "2026-05-01", name: "Dia do Trabalho" },
  { date: "2026-06-04", name: "Corpus Christi" },
  { date: "2026-09-07", name: "Independência do Brasil" },
  { date: "2026-10-12", name: "Nossa Senhora Aparecida" },
  { date: "2026-11-02", name: "Finados" },
  { date: "2026-11-15", name: "Proclamação da República" },
  { date: "2026-11-20", name: "Consciência Negra" },
  { date: "2026-12-25", name: "Natal" },
];
