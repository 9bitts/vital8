import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { hasOrgFeature } from "@/lib/features/subscription.service";
import Link from "next/link";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
  const ok = await hasOrgFeature(ctx.organizationId, "marketing");
  if (!ok) redirect("/app/assinatura");

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href="/app/marketing/leads" className="rounded border px-3 py-1">
          Leads
        </Link>
        <Link href="/app/marketing/campanhas" className="rounded border px-3 py-1">
          Campanhas
        </Link>
        <Link href="/app/marketing/landing-pages" className="rounded border px-3 py-1">
          Landing pages
        </Link>
        <Link href="/app/marketing/dashboard" className="rounded border px-3 py-1">
          Dashboard
        </Link>
        <Link href="/app/marketing/indicacoes" className="rounded border px-3 py-1">
          Indicações
        </Link>
        <Link href="/app/marketing/depoimentos" className="rounded border px-3 py-1">
          Depoimentos
        </Link>
      </nav>
      {children}
    </div>
  );
}
