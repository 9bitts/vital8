import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Doctor8LoginCtas } from "@/modules/core/components/doctor8-login-ctas";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-xl font-semibold tracking-tight">Vital8</div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Button variant="ghost" asChild>
            <Link href="/entrar">Entrar</Link>
          </Button>
          <Doctor8LoginCtas variant="primary" />
          <Button asChild>
            <Link href="/cadastro">Começar grátis</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-5xl font-semibold tracking-tight text-zinc-900">
            Gestão completa para quem cuida de vidas
          </h1>
          <p className="text-lg text-zinc-600">
            ERP vertical em saúde para clínicas, consultórios, profissionais
            autônomos, associações e laboratórios. Multi-organização, seguro e
            preparado para crescer com você.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/cadastro">Criar conta</Link>
            </Button>
            <Doctor8LoginCtas variant="primary" className="h-11 px-8 text-base" />
            <Button size="lg" variant="outline" asChild>
              <Link href="/entrar">Já sou cliente</Link>
            </Button>
          </div>
        </div>

        <section className="mt-16 max-w-3xl border-t border-zinc-200 pt-10">
          <h2 className="text-lg font-semibold text-zinc-900">
            Já tem conta Doctor8?
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Entre com o mesmo login da Doctor8 — clínica, empresa, farmácia ou
            laboratório (CNPJ).
          </p>
          <div className="mt-6">
            <Doctor8LoginCtas variant="grid" />
          </div>
        </section>
      </main>
    </div>
  );
}
