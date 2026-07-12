import type {
  FhirBundle,
  FhirOperationOutcome,
} from "@/modules/fhir/types/fhir-types";
import type { RndsAdapter, RndsAdapterConfig, RndsSubmitResult, RndsTokenResponse } from "./types";

const REJECTION_DIAGNOSTICS: Record<string, string> = {
  "invalid-cpf": "CPF do paciente inválido ou ausente no perfil BR",
  "invalid-cnes": "CNES do estabelecimento inválido ou não credenciado",
  "duplicate-entry": "Registro já enviado anteriormente (protocolo duplicado)",
  "schema-validation": "Bundle não conforme perfil RNDS — verifique cardinalidades",
  "certificate-expired": "Certificado ICP-Brasil expirado ou não reconhecido",
};

function buildOperationOutcome(code: string, diagnostics: string): FhirOperationOutcome {
  return {
    resourceType: "OperationOutcome",
    issue: [{ severity: "error", code, diagnostics }],
  };
}

export class MockRndsAdapter implements RndsAdapter {
  private tokensIssued = 0;

  async authenticate(config: RndsAdapterConfig): Promise<RndsTokenResponse> {
    this.tokensIssued++;
    if (!config.requesterId) {
      throw new Error("requesterId obrigatório");
    }
    if (!config.certificateEncrypted && !config.certificateReference) {
      throw new Error("Certificado ICP-Brasil obrigatório");
    }
    return {
      access_token: `mock-rnds-token-${config.environment}-${this.tokensIssued}`,
      token_type: "Bearer",
      expires_in: 900,
    };
  }

  async submitBundle(
    config: RndsAdapterConfig,
    token: string,
    bundle: Record<string, unknown>,
    registrationType: "RAC" | "EXAM_RESULT",
  ): Promise<RndsSubmitResult> {
    if (!token.startsWith("mock-rnds-token")) {
      throw new Error("Token inválido");
    }

    const fhirBundle = bundle as FhirBundle;
    const patient = fhirBundle.entry?.find((e) => e.resource?.resourceType === "Patient")?.resource as
      | { identifier?: Array<{ system?: string; value?: string }> }
      | undefined;

    const cpf = patient?.identifier?.find((i) => i.system?.includes("cpf"))?.value;

    // Simula rejeição real: CPF terminado em 000
    if (cpf?.endsWith("000")) {
      const outcome = buildOperationOutcome(
        "invalid-cpf",
        REJECTION_DIAGNOSTICS["invalid-cpf"],
      );
      return {
        protocol: `RNDS-REJ-${Date.now()}`,
        status: "REJEITADO",
        response: outcome as unknown as Record<string, unknown>,
      };
    }

    // Simula erro de schema se bundle vazio
    if (!fhirBundle.entry?.length) {
      const outcome = buildOperationOutcome(
        "schema-validation",
        REJECTION_DIAGNOSTICS["schema-validation"],
      );
      return {
        protocol: `RNDS-REJ-${Date.now()}`,
        status: "REJEITADO",
        response: outcome as unknown as Record<string, unknown>,
      };
    }

    const protocol = `RNDS-${config.environment.slice(0, 3)}-${registrationType}-${Date.now().toString(36).toUpperCase()}`;
    return {
      protocol,
      status: "ACEITO",
      response: {
        resourceType: "Bundle",
        type: "transaction-response",
        entry: [{ response: { status: "201 Created", location: protocol } }],
      },
    };
  }

  async testConnection(config: RndsAdapterConfig): Promise<{ ok: boolean; message: string }> {
    try {
      await this.authenticate(config);
      return {
        ok: true,
        message: `Conexão ${config.environment} OK (mock — pronto para credencial real)`,
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Falha na conexão" };
    }
  }
}

export function translateOperationOutcome(response: Record<string, unknown>): string[] {
  const outcome = response as FhirOperationOutcome;
  if (outcome.resourceType !== "OperationOutcome" || !outcome.issue) {
    return ["Resposta de erro sem OperationOutcome estruturado"];
  }
  return outcome.issue.map((issue) => {
    const known = issue.code ? REJECTION_DIAGNOSTICS[issue.code] : null;
    return known ?? issue.diagnostics ?? `Erro RNDS: ${issue.code ?? "desconhecido"}`;
  });
}
