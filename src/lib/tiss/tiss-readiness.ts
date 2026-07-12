import { adminPrisma } from "@/lib/db/admin-client";
import { SUPPORTED_TISS_VERSIONS, isTissVersionDeprecated } from "./version";

export type TissReadiness = {
  moduleAvailable: boolean;
  supportedVersions: string[];
  insurersConfigured: number;
  deprecatedVersionInsurers: number;
  orgCnesConfigured: boolean;
  transportMode: string;
  productionReady: boolean;
  note: string;
};

export async function getTissReadiness(
  organizationId: string,
): Promise<TissReadiness> {
  const [org, insurers] = await Promise.all([
    adminPrisma.organization.findFirst({
      where: { id: organizationId },
      select: { plan: true, settings: true },
    }),
    adminPrisma.healthInsurer.count({
      where: { organizationId, deletedAt: null },
    }),
  ]);

  const deprecatedCount = await adminPrisma.healthInsurer.count({
    where: {
      organizationId,
      deletedAt: null,
      tissVersion: { startsWith: "3." },
    },
  });

  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  const orgCnesConfigured = Boolean(String(settings.cnes ?? "").trim());
  const moduleAvailable = org?.plan === "ENTERPRISE" || org?.plan === "PRO";
  const transportMode = "mock";

  const productionReady =
    moduleAvailable &&
    insurers > 0 &&
    orgCnesConfigured &&
    deprecatedCount === 0;

  let note: string;
  if (!moduleAvailable) {
    note = "TISS disponível nos planos PRO e ENTERPRISE.";
  } else if (insurers === 0) {
    note = "Cadastre operadoras em Configurações → Convênios.";
  } else if (!orgCnesConfigured) {
    note = "Defina CNES da clínica em Configurações da organização (settings.cnes).";
  } else if (deprecatedCount > 0) {
    note = `${deprecatedCount} operadora(s) em versão legada 3.05 — atualize para 4.03 antes de jul/2026.`;
  } else {
    note = "Stack TISS 4.03 pronto — validação de lote, XML com hash MD5 e exportação contábil.";
  }

  return {
    moduleAvailable: Boolean(moduleAvailable),
    supportedVersions: [...SUPPORTED_TISS_VERSIONS],
    insurersConfigured: insurers,
    deprecatedVersionInsurers: deprecatedCount,
    orgCnesConfigured,
    transportMode,
    productionReady,
    note,
  };
}

export function isInsurerTissVersionDeprecated(version: string): boolean {
  return isTissVersionDeprecated(version);
}
