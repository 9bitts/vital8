import { requireAuth } from "@/lib/auth/guards";
import { ConversationsInbox } from "@/modules/engagement/components/conversations-inbox";
import { listConversationsAction } from "@/modules/engagement/actions/conversation.actions";
import Link from "next/link";

export default async function ConversasPage() {
  await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
  const threads = await listConversationsAction();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Central de conversas</h1>
        <Link href="/app/relacionamento" className="text-sm text-blue-700">
          ← Comunicação
        </Link>
      </div>
      <p className="text-sm text-zinc-500">
        WhatsApp inbound + respostas da recepção com sugestão da IA secretária.
      </p>
      <ConversationsInbox initialThreads={threads} />
    </div>
  );
}
