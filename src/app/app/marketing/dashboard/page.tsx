import { getMarketingDashboardAction } from "@/modules/marketing/actions/marketing.actions";
import { MarketingDashboardPanel } from "@/modules/marketing/components/marketing-dashboard";

export default async function MarketingDashboardPage() {
  const data = await getMarketingDashboardAction();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard de marketing</h1>
      <MarketingDashboardPanel data={data} />
    </div>
  );
}
