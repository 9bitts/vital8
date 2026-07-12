import type {
  DrugSearchResult,
  MemedSessionInput,
  MemedSessionResult,
  MemedWebhookResult,
  PrescriptionProviderAdapter,
} from "./types";
import { LocalDrugCatalogAdapter } from "./local.adapter";

const MEMED_API = process.env.MEMED_API_URL ?? "https://api.memed.com.br/v1";

/** Adapter Memed — busca remota + embed + webhook (mock quando sem credenciais). */
export class MemedPrescriptionAdapter implements PrescriptionProviderAdapter {
  readonly providerType = "MEMED" as const;
  private localFallback = new LocalDrugCatalogAdapter();

  async searchDrugs(query: string, limit = 20): Promise<DrugSearchResult[]> {
    if (!process.env.MEMED_API_URL) {
      return this.localFallback.searchDrugs(query, limit);
    }

    try {
      const res = await fetch(
        `${MEMED_API}/medicamentos?q=${encodeURIComponent(query)}&limit=${limit}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return this.localFallback.searchDrugs(query, limit);
      const data = (await res.json()) as {
        data?: Array<Record<string, unknown>>;
      };
      return (data.data ?? []).map((item, i) => ({
        id: String(item.id ?? `memed-${i}`),
        name: String(item.nome ?? item.name ?? ""),
        activeIngredient: String(item.principio_ativo ?? ""),
        concentration: String(item.concentracao ?? ""),
        pharmaceuticalForm: String(item.forma ?? ""),
        route: String(item.via ?? ""),
        isControlled: Boolean(item.controlado),
        externalId: String(item.id ?? ""),
      }));
    } catch {
      return this.localFallback.searchDrugs(query, limit);
    }
  }

  async createEmbedSession(input: MemedSessionInput): Promise<MemedSessionResult> {
    const sessionId = `memed_${input.organizationId}_${Date.now()}`;
    const base = process.env.MEMED_EMBED_URL ?? "https://embed.memed.com.br";
    const partner = input.memedPartnerId ?? "vital8-demo";

    if (process.env.MEMED_API_URL && input.memedApiKey) {
      try {
        const res = await fetch(`${MEMED_API}/sessions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${input.memedApiKey}`,
          },
          body: JSON.stringify({
            parceiro: partner,
            medico: { id: input.professionalId, nome: input.professionalName },
            paciente: { id: input.patientExternalId, nome: input.patientName },
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { url?: string; id?: string };
          return {
            embedUrl: data.url ?? `${base}?session=${sessionId}`,
            sessionId: data.id ?? sessionId,
          };
        }
      } catch {
        // fallback embed mock
      }
    }

    return {
      embedUrl: `${base}?partner=${partner}&session=${sessionId}&prof=${input.professionalId}`,
      sessionId,
    };
  }

  parseWebhook(payload: unknown): MemedWebhookResult | null {
    const body = payload as {
      event?: string;
      prescription_id?: string;
      id?: string;
      status?: string;
      items?: Array<{ drug?: string; dosage?: string }>;
    };
    const id = body.prescription_id ?? body.id;
    if (!id) return null;

    const status =
      body.status === "cancelled" || body.event === "prescription.cancelled"
        ? "CANCELLED"
        : "COMPLETED";

    return {
      externalPrescriptionId: String(id),
      status,
      items: body.items?.map((i) => ({
        drugName: i.drug ?? "",
        dosage: i.dosage ?? "",
      })),
    };
  }
}
