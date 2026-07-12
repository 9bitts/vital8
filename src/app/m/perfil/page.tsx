import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { signOut } from "@/lib/auth/auth";
import { MobilePendingConflicts } from "@/modules/mobile/components/mobile-pending-conflicts";

export default async function MobilePerfilPage() {
  const ctx = await requireAuth();

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-medium">{ctx.userName}</h2>
        <p className="text-sm text-zinc-500">{ctx.userEmail}</p>
        <p className="text-xs text-zinc-400">{ctx.role}</p>
      </section>

      <MobilePendingConflicts />

      <nav className="space-y-2">
        {(ctx.role === "PROFISSIONAL_SAUDE" || ctx.role === "OWNER") && (
          <Link
            href="/m/repasse"
            className="flex min-h-11 items-center rounded-lg border px-4 dark:border-zinc-800"
          >
            Repasse (leitura)
          </Link>
        )}
        <Link
          href="/app/configuracoes"
          className="flex min-h-11 items-center rounded-lg border px-4 dark:border-zinc-800"
        >
          Configurações
        </Link>
      </nav>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/entrar" });
        }}
      >
        <button
          type="submit"
          className="min-h-11 w-full rounded-md border border-red-200 px-4 text-red-700 dark:border-red-900 dark:text-red-300"
        >
          Sair (limpa cache offline)
        </button>
      </form>
    </div>
  );
}
