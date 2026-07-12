import type { NfseIssueInput } from "./types";

/** Monta payload DPS (Declaração de Prestação de Serviço) — Padrão Nacional NFS-e LC 214/2025. */
export function buildDpsPayload(input: NfseIssueInput, dpsNumber: string) {
  const issRate = (input.issRateBasisPoints ?? 500) / 10000;
  const issValueCents = Math.round(input.amountCents * issRate);

  const payload: Record<string, unknown> = {
    versao: "1.00",
    tpAmb: process.env.NODE_ENV === "production" ? 1 : 2,
    dps: {
      nDPS: dpsNumber,
      dhEmi: new Date().toISOString(),
      prest: {
        CNPJ: input.organizationDocument.replace(/\D/g, "").length === 14
          ? input.organizationDocument.replace(/\D/g, "")
          : undefined,
        CPF: input.organizationDocument.replace(/\D/g, "").length === 11
          ? input.organizationDocument.replace(/\D/g, "")
          : undefined,
        IM: input.inscricaoMunicipal ?? null,
        cMun: input.municipioIbgeCode ?? null,
        CNAE: input.cnae ?? null,
      },
      toma: {
        xNome: input.patientName,
        CPF: input.patientDocumentType === "CPF"
          ? input.patientDocument?.replace(/\D/g, "")
          : undefined,
        CNPJ: input.patientDocumentType === "CNPJ"
          ? input.patientDocument?.replace(/\D/g, "")
          : undefined,
      },
      serv: {
        cTribNac: input.nacionalServiceCode ?? "040101",
        xDescServ: input.serviceDescription,
        vServ: (input.amountCents / 100).toFixed(2),
        trib: {
          tribISSQN: 1,
          pAliq: (issRate * 100).toFixed(2),
          vISS: (issValueCents / 100).toFixed(2),
        },
      },
    },
  };

  if (input.cbsIbsEnabled) {
    const cbsRate = (input.cbsRateBasisPoints ?? 0) / 10000;
    const ibsRate = (input.ibsRateBasisPoints ?? 0) / 10000;
    (payload.dps as Record<string, unknown>).reformaTributaria = {
      cbs: {
        pAliq: (cbsRate * 100).toFixed(4),
        vCBS: ((input.amountCents * cbsRate) / 100).toFixed(2),
      },
      ibs: {
        pAliq: (ibsRate * 100).toFixed(4),
        vIBS: ((input.amountCents * ibsRate) / 100).toFixed(2),
      },
    };
  }

  return payload;
}

export function generateAccessKey(dpsNumber: string, orgDocument: string): string {
  const doc = orgDocument.replace(/\D/g, "").padStart(14, "0").slice(0, 14);
  const ts = Date.now().toString().slice(-11);
  return `NFS${doc}${dpsNumber}${ts}`.slice(0, 50);
}
