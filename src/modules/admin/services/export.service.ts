import { randomBytes } from "crypto";
import { adminPrisma } from "@/lib/db/admin-client";

export async function requestOrganizationExport(organizationId: string, requestedById: string) {
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return adminPrisma.organizationExport.create({
    data: {
      organizationId,
      requestedById,
      downloadToken: token,
      expiresAt,
      status: "PENDING",
    },
  });
}

export async function processOrganizationExport(exportId: string) {
  const exp = await adminPrisma.organizationExport.findFirstOrThrow({
    where: { id: exportId },
  });

  await adminPrisma.organizationExport.update({
    where: { id: exportId },
    data: { status: "PROCESSING" },
  });

  try {
    const orgId = exp.organizationId;
    const [org, patients, appointments, sales] = await Promise.all([
      adminPrisma.organization.findFirst({ where: { id: orgId } }),
      adminPrisma.patient.findMany({ where: { organizationId: orgId }, take: 1000 }),
      adminPrisma.appointment.findMany({ where: { organizationId: orgId }, take: 1000 }),
      adminPrisma.sale.findMany({ where: { organizationId: orgId }, take: 1000 }),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      organization: org,
      modules: {
        patients: patients.length,
        appointments: appointments.length,
        sales: sales.length,
      },
      sample: { patients: patients.slice(0, 5), appointments: appointments.slice(0, 5) },
    };

    const storageKey = `exports/${orgId}/${exportId}.json`;
    console.log(`[Vital8 Export] ${storageKey} (${Object.keys(payload).length} campos)`);

    return adminPrisma.organizationExport.update({
      where: { id: exportId },
      data: {
        status: "READY",
        storageKey,
        completedAt: new Date(),
      },
    });
  } catch (e) {
    return adminPrisma.organizationExport.update({
      where: { id: exportId },
      data: {
        status: "FAILED",
        errorMessage: e instanceof Error ? e.message : "Erro",
      },
    });
  }
}

export async function getExportByToken(token: string) {
  return adminPrisma.organizationExport.findFirst({
    where: {
      downloadToken: token,
      status: "READY",
      expiresAt: { gt: new Date() },
    },
  });
}
