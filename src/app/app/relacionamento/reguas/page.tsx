import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { listAutomationRulesAction, listTemplatesAction } from "@/modules/engagement/actions/engagement.actions";

export default async function ReguasPage() {
  await requireAuth(["OWNER", "ADMIN"]);
  const [rules, templates] = await Promise.all([
    listAutomationRulesAction(),
    listTemplatesAction(),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-sm">
        <Link href="/app/relacionamento">Comunicação</Link>
        <Link href="/app/relacionamento/nps">NPS</Link>
        <Link href="/app/relacionamento/aprovacoes">Aprovações online</Link>
      </div>
      <h1 className="text-xl font-semibold">Réguas e templates</h1>
      <section>
        <h2 className="font-medium">Templates ({templates.length})</h2>
        <ul className="text-sm mt-2 space-y-1">
          {templates.map((t) => (
            <li key={t.id}>{t.name} — {t.eventKey} ({t.channel})</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-medium">Réguas ({rules.length})</h2>
        <ul className="text-sm mt-2 space-y-1">
          {rules.map((r) => (
            <li key={r.id}>
              {r.name}: {r.triggerEvent} {r.offsetValue}{" "}
              {r.offsetUnit === "HOURS" ? "h" : "d"} — {r.isActive ? "ativa" : "inativa"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
