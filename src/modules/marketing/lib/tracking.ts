/** Normaliza telefone para busca/dedup (apenas dígitos). */
export function normalizePhoneSearch(phone: string): string {
  return phone.replace(/\D/g, "");
}

export type UtmCapture = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
};

export function parseUtmFromSearchParams(
  params: URLSearchParams | Record<string, string | undefined>,
): UtmCapture {
  const get = (k: string) => {
    if (params instanceof URLSearchParams) return params.get(k) ?? undefined;
    return params[k];
  };
  return {
    utmSource: get("utm_source") ?? get("utmSource"),
    utmMedium: get("utm_medium") ?? get("utmMedium"),
    utmCampaign: get("utm_campaign") ?? get("utmCampaign"),
    utmTerm: get("utm_term") ?? get("utmTerm"),
    utmContent: get("utm_content") ?? get("utmContent"),
  };
}

export function appendUtmToUrl(baseUrl: string, utm: UtmCapture): string {
  const url = new URL(baseUrl, "http://local");
  if (utm.utmSource) url.searchParams.set("utm_source", utm.utmSource);
  if (utm.utmMedium) url.searchParams.set("utm_medium", utm.utmMedium);
  if (utm.utmCampaign) url.searchParams.set("utm_campaign", utm.utmCampaign);
  if (utm.utmTerm) url.searchParams.set("utm_term", utm.utmTerm);
  if (utm.utmContent) url.searchParams.set("utm_content", utm.utmContent);
  return `${url.pathname}${url.search}`;
}
