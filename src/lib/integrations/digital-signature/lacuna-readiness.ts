import { isLacunaConfigured } from "./lacuna-client";

export type LacunaReadiness = {
  configured: boolean;
  endpoint: string;
  securityContext: boolean;
  productionReady: boolean;
  note: string;
};

export function getLacunaReadiness(): LacunaReadiness {
  const configured = isLacunaConfigured();
  const endpoint =
    process.env.LACUNA_ENDPOINT?.trim() || "https://core.pki.rest";
  const securityContext = Boolean(process.env.LACUNA_SECURITY_CONTEXT?.trim());
  const productionReady = configured;

  let note: string;
  if (!configured) {
    note =
      "Lacuna não configurada — assinatura ICP_LACUNA usa fluxo indisponível; mantenha DEV_SIMPLE ou ICP_A1/DSAS.";
  } else if (!securityContext) {
    note =
      "API key definida. Para testes com certificados Lacuna, configure LACUNA_SECURITY_CONTEXT (GUID do contexto ICP-Brasil de teste).";
  } else {
    note =
      "Lacuna configurada. Fluxo: redirect BirdID/VIDaaS → callback com PDF PAdES no storage.";
  }

  return {
    configured,
    endpoint,
    securityContext,
    productionReady,
    note,
  };
}
