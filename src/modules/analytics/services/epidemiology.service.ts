import { adminPrisma } from "@/lib/db/admin-client";

type CidRow = { code: string; description: string; count: number };

/** Relatório epidemiológico agregado — sem identificação de pacientes. */
export async function getEpidemiologyReport(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<CidRow[]> {
  const sections = await adminPrisma.encounterSection.findMany({
    where: {
      organizationId,
      sectionType: "HIPOTESE_DIAGNOSTICA",
      encounter: {
        organizationId,
        startedAt: { gte: from, lte: to },
        status: "ASSINADO",
        deletedAt: null,
      },
    },
    select: { structuredData: true },
  });

  const counts = new Map<string, number>();
  for (const s of sections) {
    const data = s.structuredData as { cidCodes?: string[] };
    for (const code of data.cidCodes ?? []) {
      if (!code) continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  const codes = Array.from(counts.keys());
  const catalog =
    codes.length > 0
      ? await adminPrisma.cid10Code.findMany({
          where: { code: { in: codes } },
          select: { code: true, description: true },
        })
      : [];
  const descMap = new Map(catalog.map((c) => [c.code, c.description]));

  return Array.from(counts.entries())
    .map(([code, count]) => ({
      code,
      description: descMap.get(code) ?? code,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}
