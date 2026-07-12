import { requireAuth } from "@/lib/auth/guards";
import { FiscalSettingsPanel } from "@/modules/finance/components/fiscal-settings-panel";
import { getFiscalSettingsAction } from "@/modules/finance/actions/fiscal.actions";

export default async function FiscalConfigPage() {
  await requireAuth(["OWNER", "ADMIN"]);
  const settings = await getFiscalSettingsAction();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações fiscais</h1>
        <p className="text-zinc-600">
          NFS-e Padrão Nacional, Receita Saúde e reforma tributária (CBS/IBS)
        </p>
      </div>
      <FiscalSettingsPanel initial={settings} />
    </div>
  );
}
