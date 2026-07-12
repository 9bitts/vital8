import { requireAuth } from "@/lib/auth/guards";
import { AuthorizationsPanel } from "@/modules/tiss/components/authorizations-panel";
import {
  listAuthorizationsAction,
  listExpiringAuthAction,
  listInsurersAction,
} from "@/modules/tiss/actions/tiss.actions";
import { adminPrisma } from "@/lib/db/admin-client";
import { auth } from "@/lib/auth/auth";

export default async function AutorizacoesPage() {
  await requireAuth(["OWNER", "ADMIN", "FINANCEIRO", "RECEPCAO"]);
  const session = await auth();
  const orgId = session!.organizationId!;

  const [authorizations, expiring, insurers, patients, services] = await Promise.all([
    listAuthorizationsAction(),
    listExpiringAuthAction(),
    listInsurersAction(),
    adminPrisma.patient.findMany({
      where: { organizationId: orgId, deletedAt: null },
      take: 50,
      select: { id: true, fullName: true },
    }),
    adminPrisma.service.findMany({
      where: { organizationId: orgId, deletedAt: null, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Central de autorizações</h1>
      <AuthorizationsPanel
        authorizations={authorizations}
        expiring={expiring}
        insurers={insurers.map((i) => ({ id: i.id, name: i.name }))}
        patients={patients}
        services={services}
      />
    </div>
  );
}
