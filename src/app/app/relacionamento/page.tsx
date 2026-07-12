import { requireAuth } from "@/lib/auth/guards";
import { CommunicationDashboard } from "@/modules/engagement/components/communication-dashboard";
import { listCommunicationsAction } from "@/modules/engagement/actions/engagement.actions";

export default async function RelacionamentoPage() {
  await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
  const logs = await listCommunicationsAction();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Central de comunicação</h1>
      <p className="text-sm">
        <a href="/app/relacionamento/conversas" className="text-blue-700 underline">
          Central de conversas WhatsApp
        </a>
        {" · "}
        <a href="/app/relacionamento/reguas" className="text-blue-700 underline">
          Réguas
        </a>
      </p>
      <CommunicationDashboard logs={logs} />
    </div>
  );
}
