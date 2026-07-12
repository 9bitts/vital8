import { z } from "zod";

const DIAL_BY_COUNTRY: Record<string, string> = {
  BR: "55",
  US: "1",
  PT: "351",
  ES: "34",
  AR: "54",
  MX: "52",
  CO: "57",
  CL: "56",
  PE: "51",
  UY: "598",
  PY: "595",
  VE: "58",
  BO: "591",
  EC: "593",
};

const phoneInputSchema = z.string().min(1).max(32);

/** Normalize phone for wa.me / Graph API — digits only, with country prefix when missing. */
export function waPhoneDigits(raw: string, country?: string | null): string {
  const parsed = phoneInputSchema.safeParse(raw);
  if (!parsed.success) return "";

  const digits = parsed.data.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length >= 12) return digits;

  const dial =
    DIAL_BY_COUNTRY[(country || "BR").toUpperCase()] ?? DIAL_BY_COUNTRY.BR;

  if (digits.startsWith("0")) return dial + digits.slice(1);
  if (digits.startsWith(dial)) return digits;
  return dial + digits;
}

/** E.164 digits only, no +. Prepends default country code when missing. */
export function normalizeWhatsAppPhone(
  raw: string,
  defaultCountry = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE?.trim() || "55",
): string | null {
  const parsed = phoneInputSchema.safeParse(raw);
  if (!parsed.success) return null;

  const digits = parsed.data.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) {
    return `${defaultCountry}${digits}`;
  }
  return digits.length >= 10 ? `${defaultCountry}${digits}` : null;
}
