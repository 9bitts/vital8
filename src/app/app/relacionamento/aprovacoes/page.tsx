import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { listPendingOnlineAction } from "@/modules/engagement/actions/engagement.actions";
import { OnlineApprovalPanel } from "@/modules/engagement/components/online-approval-panel";

export default async function OnlineApprovalsPage() {
  await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
  const pending = await listPendingOnlineAction();
  return (
    <div className="space-y-4">
      <Link href="/app/relacionamento" className="text-sm text-blue-700">← Comunicação</Link>
      <h1 className="text-xl font-semibold">Agendamentos online pendentes</h1>
      <OnlineApprovalPanel appointments={pending} />
    </div>
  );
}
