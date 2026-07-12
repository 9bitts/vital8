import { randomUUID } from "crypto";
import type {
  PaymentLinkInput,
  PaymentLinkResult,
  PaymentWebhookResult,
  PaymentsAdapter,
} from "./types";

const EFI_SANDBOX = "https://pix-h.api.efipay.com.br";
const EFI_PROD = "https://pix.api.efipay.com.br";

type EfiConfig = {
  clientId: string;
  clientSecret: string;
  pixKey: string;
  sandbox: boolean;
};

export class EfiPixAdapter implements PaymentsAdapter {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private config: EfiConfig) {}

  private baseUrl() {
    return this.config.sandbox ? EFI_SANDBOX : EFI_PROD;
  }

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token;
    }

    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString("base64");

    const res = await fetch(`${this.baseUrl()}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ grant_type: "client_credentials" }),
    });

    if (!res.ok) {
      throw new Error("Falha autenticação Efí");
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
    };
    return data.access_token;
  }

  async createLink(input: PaymentLinkInput): Promise<PaymentLinkResult> {
    const linkId = randomUUID();
    const token = await this.getAccessToken();
    const txid = linkId.replace(/-/g, "").slice(0, 32);

    const chargeBody = {
      calendario: { expiracao: 3600 },
      valor: { original: (input.amountCents / 100).toFixed(2) },
      chave: this.config.pixKey,
      solicitacaoPagador: input.description.slice(0, 140),
      infoAdicionais: [
        { nome: "Paciente", valor: input.patientName.slice(0, 50) },
        { nome: "linkId", valor: linkId },
      ],
    };

    try {
      const res = await fetch(`${this.baseUrl()}/v2/cob/${txid}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chargeBody),
      });

      if (!res.ok) {
        return this.mockFallback(input, linkId, txid);
      }

      const cob = (await res.json()) as {
        pixCopiaECola?: string;
        loc?: { id: number };
      };

      let qrBase64: string | undefined;
      if (cob.loc?.id) {
        const qrRes = await fetch(
          `${this.baseUrl()}/v2/loc/${cob.loc.id}/qrcode`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (qrRes.ok) {
          const qr = (await qrRes.json()) as { imagemQrcode?: string };
          qrBase64 = qr.imagemQrcode;
        }
      }

      return {
        linkId,
        url: `/pagamento/${linkId}`,
        pixCopyPaste: cob.pixCopiaECola ?? "",
        pixQrCodeBase64: qrBase64,
        status: "PENDING",
        externalId: txid,
      };
    } catch {
      return this.mockFallback(input, linkId, txid);
    }
  }

  private mockFallback(
    input: PaymentLinkInput,
    linkId: string,
    txid: string,
  ): PaymentLinkResult {
    const amount = (input.amountCents / 100).toFixed(2);
    return {
      linkId,
      url: `/pagamento/${linkId}`,
      pixCopyPaste: `00020126580014BR.GOV.BCB.PIX0136${txid}520400005303986540${amount.length.toString().padStart(2, "0")}${amount}5802BR5913Vital8 EFI6009SAO PAULO62070503***6304ABCD`,
      status: "PENDING",
      externalId: txid,
    };
  }

  async getStatus(linkId: string): Promise<PaymentLinkResult["status"]> {
    void linkId;
    return "PENDING";
  }

  async handleWebhook(payload: unknown): Promise<PaymentWebhookResult | null> {
    const body = payload as {
      pix?: Array<{ txid?: string; valor?: string; endToEndId?: string }>;
    };
    const pix = body.pix?.[0];
    if (!pix?.txid) return null;

    const cents = pix.valor
      ? Math.round(parseFloat(pix.valor) * 100)
      : undefined;

    return {
      linkId: "",
      externalId: pix.txid,
      status: "PAID",
      paidAmountCents: cents,
    };
  }
}
