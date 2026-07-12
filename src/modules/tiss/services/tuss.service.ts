import { adminPrisma } from "@/lib/db/admin-client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { serviceTussMappingSchema } from "../schemas/tiss.schema";

export async function searchTussProcedures(query: string, limit = 20) {
  return adminPrisma.tussProcedure.findMany({
    where: {
      isActive: true,
      OR: [
        { code: { contains: query } },
        { term: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { code: "asc" },
  });
}

export async function listTussProcedures(limit = 100) {
  return adminPrisma.tussProcedure.findMany({
    where: { isActive: true },
    take: limit,
    orderBy: { code: "asc" },
  });
}

export async function importTussFromCsv(csvContent: string) {
  const lines = csvContent.trim().split(/\r?\n/);
  const header = lines[0]?.toLowerCase();
  if (!header?.includes("code") && !header?.includes("codigo")) {
    throw new Error("CSV deve conter colunas code/codigo e term/termo");
  }

  let imported = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";").map((c) => c.trim());
    if (cols.length < 2) continue;
    const code = cols[0].replace(/"/g, "");
    const term = cols[1].replace(/"/g, "");
    if (!code || !term) continue;

    await adminPrisma.tussProcedure.upsert({
      where: { code },
      create: { code, term },
      update: { term, isActive: true },
    });
    imported++;
  }
  return imported;
}

export async function mapServiceToTuss(db: TenantClient, input: unknown) {
  const data = serviceTussMappingSchema.parse(input);
  const tuss = await adminPrisma.tussProcedure.findFirstOrThrow({
    where: { id: data.tussProcedureId },
  });

  return db.service.update({
    where: { id: data.serviceId },
    data: {
      tussProcedureId: data.tussProcedureId,
      tussCode: tuss.code,
    },
  });
}

export async function listServiceTussMappings(db: TenantClient) {
  return db.service.findMany({
    where: { deletedAt: null, isActive: true },
    include: { tussProcedure: true },
    orderBy: { name: "asc" },
  });
}
