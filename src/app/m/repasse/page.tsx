import { requireAuth } from "@/lib/auth/guards";
import { formatBRL } from "@/lib/money";
import Link from "next/link";

export default async function MobileRepassePage() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"]);

  const prof = await ctx.db.professional.findFirst({
    where: { userId: ctx.userId, isActive: true },
    select: { id: true, displayName: true },
  });

  const statements = prof
    ? await ctx.db.commissionStatement.findMany({
        where: { professionalId: prof.id },
        orderBy: { periodEnd: "desc" },
        take: 6,
        include: {
          items: { take: 5, select: { commissionCents: true, description: true } },
        },
      })
    : [];

  return (
    <div className="space-y-4">
      <Link href="/m/perfil" className="text-sm text-blue-600 dark:text-blue-400">
        ← Perfil
      </Link>
      <h2 className="font-medium">Repasse (somente leitura)</h2>
      {!prof && (
        <p className="text-sm text-zinc-500">Nenhum vínculo profissional encontrado.</p>
      )}
      <ul className="space-y-3">
        {statements.map((s) => (
          <li key={s.id} className="rounded-lg border p-4 dark:border-zinc-800">
            <p className="font-medium">
              {new Date(s.periodStart).toLocaleDateString("pt-BR")} —{" "}
              {new Date(s.periodEnd).toLocaleDateString("pt-BR")}
            </p>
            <p className="text-lg font-semibold">{formatBRL(s.totalCents)}</p>
            <p className="text-xs text-zinc-500">{s.status}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">
        Dados financeiros sempre online — nunca em cache offline.
      </p>
    </div>
  );
}
