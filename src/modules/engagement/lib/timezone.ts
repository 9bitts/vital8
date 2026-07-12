export const SAO_PAULO_TZ = "America/Sao_Paulo";

export function formatInSaoPaulo(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleString("pt-BR", {
    timeZone: SAO_PAULO_TZ,
    ...options,
  });
}

/** Calcula instante de envio relativo a uma referência (negativo = antes). */
export function computeOffsetTime(
  reference: Date,
  offsetValue: number,
  unit: "HOURS" | "DAYS",
): Date {
  const ms =
    unit === "HOURS"
      ? offsetValue * 60 * 60 * 1000
      : offsetValue * 24 * 60 * 60 * 1000;
  return new Date(reference.getTime() + ms);
}

/** H-48 antes do agendamento às 14:00 SP → instante UTC correto. */
export function confirmationScheduleUtc(
  appointmentStartsAt: Date,
  hoursBefore: number,
): Date {
  return new Date(appointmentStartsAt.getTime() - hoursBefore * 60 * 60 * 1000);
}

export function spWallClockParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}
