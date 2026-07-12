import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { REPORT_CATALOG } from "@/modules/analytics/lib/report-catalog";

export default async function RelatoriosCatalogPage() {
  await requireAuth();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Central de relatórios</h1>
      <p className="text-sm text-zinc-600">
        Catálogo unificado com exportação CSV/PDF e filtros persistentes por usuário.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {REPORT_CATALOG.map((r) => (
          <li key={r.key} className="rounded border p-4 hover:bg-zinc-50">
            <Link href={r.href} className="font-medium text-blue-700 hover:underline">
              {r.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
