import { requireAuth } from "@/lib/auth/guards";
import Link from "next/link";

export default async function ProntuarioPage() {
  await requireAuth([
    "OWNER",
    "ADMIN",
    "PROFISSIONAL_SAUDE",
    "RECEPCAO",
    "LEITURA",
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Prontuário eletrônico</h1>
      <p className="text-sm text-zinc-500">
        Inicie atendimentos pela{" "}
        <Link href="/app/recepcao" className="underline">
          recepção
        </Link>{" "}
        ou{" "}
        <Link href="/app/agenda" className="underline">
          agenda
        </Link>
        . Encontros assinados ficam imutáveis — correções via adendo.
      </p>
      <p className="text-sm">
        Configurações:{" "}
        <Link href="/app/configuracoes/prontuario" className="underline">
          formulários e templates
        </Link>
      </p>
    </div>
  );
}
