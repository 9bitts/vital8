import { listLeadsAction } from "@/modules/marketing/actions/marketing.actions";
import { LeadKanban } from "@/modules/marketing/components/lead-kanban";

export default async function MarketingLeadsPage() {
  const leads = await listLeadsAction();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Funil de leads</h1>
      <LeadKanban leads={leads} />
    </div>
  );
}
