import { requireAuth } from "@/lib/auth/guards";
import { EpidemiologyReportClient } from "@/modules/analytics/components/epidemiology-report";

export default async function EpidemiologiaPage() {
  await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Relatório epidemiológico</h1>
      <p className="text-sm text-zinc-600">
        CIDs mais frequentes no período (dados agregados, sem identificação individual).
      </p>
      <EpidemiologyReportClient />
    </div>
  );
}
