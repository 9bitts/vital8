import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { hasOrgFeature } from "@/lib/features/subscription.service";
import { adminPrisma } from "@/lib/db/admin-client";
import { MobileBottomNav } from "@/modules/mobile/components/mobile-bottom-nav";
import Link from "next/link";

export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId || !session.role) {
    redirect("/entrar?callbackUrl=/m/hoje");
  }

  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: session.organizationId },
    select: { plan: true, name: true },
  });
  const pwaOk = await hasOrgFeature(session.organizationId, "pwa");
  if (!pwaOk) redirect("/app/assinatura");

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-white dark:bg-zinc-950">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{org.name}</p>
          <h1 className="text-sm font-semibold">Vital8 Mobile</h1>
        </div>
        <Link href="/app" className="min-h-11 text-xs text-blue-600 dark:text-blue-400">
          Desktop
        </Link>
      </header>
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">{children}</main>
      <MobileBottomNav role={session.role} />
    </div>
  );
}
