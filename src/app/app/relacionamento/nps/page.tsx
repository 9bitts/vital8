import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { getNpsReportAction } from "@/modules/engagement/actions/engagement.actions";

export default async function NpsReportPage() {
  await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
  const report = await getNpsReportAction();
  return (
    <div className="space-y-4">
      <Link href="/app/relacionamento" className="text-sm text-blue-700">← Comunicação</Link>
      <h1 className="text-xl font-semibold">Relatório NPS</h1>
      <p className="text-3xl font-bold">{report.nps}</p>
      <p className="text-sm text-zinc-600">
        {report.total} respostas · {report.promoters} promotores · {report.detractors} detratores
      </p>
      <section>
        <h2 className="font-medium">Por profissional</h2>
        <ul className="text-sm space-y-1">
          {report.byProfessional.map((p) => (
            <li key={p.name}>{p.name}: média {p.avg.toFixed(1)} ({p.count})</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-medium">Comentários</h2>
        <ul className="text-sm space-y-2">
          {report.comments.map((c, i) => (
            <li key={i} className="border-l-2 pl-2">
              Nota {c.score}: {c.comment}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
