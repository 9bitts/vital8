import { requireAuth } from "@/lib/auth/guards";
import { FiscalDocumentsPanel } from "@/modules/finance/components/fiscal-documents-panel";
import { listFiscalDocumentsAction } from "@/modules/finance/actions/fiscal.actions";
import Link from "next/link";

export default async function FinanceiroFiscalPage() {
  await requireAuth(["OWNER", "ADMIN", "FINANCEIRO", "RECEPCAO"]);
  const documents = await listFiscalDocumentsAction();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documentos fiscais</h1>
          <p className="text-zinc-600">NFS-e, recibos Receita Saúde e fila de emissão</p>
        </div>
        <Link href="/app/configuracoes/fiscal" className="text-sm underline">
          Configurações fiscais
        </Link>
      </div>
      <FiscalDocumentsPanel documents={documents} />
    </div>
  );
}
