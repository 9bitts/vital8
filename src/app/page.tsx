import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-xl font-semibold tracking-tight">Vital8</div>
        <div className="flex gap-3">
          <Button variant="ghost" asChild>
            <Link href="/entrar">Entrar</Link>
          </Button>
          <Button asChild>
            <Link href="/cadastro">Começar grátis</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 py-24">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-5xl font-semibold tracking-tight text-zinc-900">
            Gestão completa para quem cuida de vidas
          </h1>
          <p className="text-lg text-zinc-600">
            ERP vertical em saúde para clínicas, consultórios, profissionais
            autônomos, associações e laboratórios. Multi-organização, seguro e
            preparado para crescer com você.
          </p>
          <div className="flex gap-3">
            <Button size="lg" asChild>
              <Link href="/cadastro">Criar conta</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/entrar">Já sou cliente</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
