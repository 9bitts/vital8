import { requireAuth } from "@/lib/auth/guards";
import { getDashboardAction } from "@/modules/analytics/actions/analytics.actions";
import { ExecutiveDashboard } from "@/modules/analytics/components/executive-dashboard";
import { ProfessionalDashboard } from "@/modules/analytics/components/professional-dashboard";
import { ReceptionDashboard } from "@/modules/analytics/components/reception-dashboard";

export const revalidate = 60;

export default async function DashboardPage() {
  const ctx = await requireAuth();
  const result = await getDashboardAction();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-600">Bem-vindo, {ctx.userName}</p>
      </div>

      {result.kind === "executive" && (
        <ExecutiveDashboard data={result.data} hideClinical={result.hideClinical} />
      )}
      {result.kind === "professional" && (
        <ProfessionalDashboard data={result.data} />
      )}
      {result.kind === "reception" && <ReceptionDashboard data={result.data} />}
      {result.kind === "simple" && (
        <ReceptionDashboard data={result.reception} />
      )}
    </div>
  );
}
