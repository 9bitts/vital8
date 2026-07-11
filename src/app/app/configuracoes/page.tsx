import { requireAuth } from "@/lib/auth/guards";
import { SettingsTabs } from "@/modules/core/components/settings-tabs";
import {
  getOrganizationAction,
  listMembersAction,
  listAuditLogsAction,
} from "@/modules/core/actions/organization.actions";

export default async function ConfiguracoesPage() {
  const ctx = await requireAuth();
  const canManage = ctx.role === "OWNER" || ctx.role === "ADMIN";

  const organization = await getOrganizationAction();
  if (!organization) {
    return <p>Organização não encontrada</p>;
  }

  const members = canManage ? await listMembersAction() : [];
  const audit = canManage
    ? await listAuditLogsAction(1)
    : { items: [], total: 0, page: 1, totalPages: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-zinc-600">
          Gerencie sua organização, membros e auditoria
        </p>
      </div>
      <SettingsTabs
        organization={organization}
        members={members}
        canManage={canManage}
        initialAudit={audit}
      />
    </div>
  );
}
