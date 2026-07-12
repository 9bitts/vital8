import { requireAuth } from "@/lib/auth/guards";
import { formatBRL } from "@/lib/money";
import { getGuidePrintAction } from "@/modules/tiss/actions/tiss.actions";
import { PrintButton } from "@/modules/tiss/components/print-button";
import type { TissGuidePayload } from "@/lib/tiss/types";

type Props = { params: { id: string } };

export default async function GuidePrintPage({ params }: Props) {
  await requireAuth(["OWNER", "ADMIN", "FINANCEIRO", "RECEPCAO"]);
  const guide = await getGuidePrintAction(params.id);
  const payload = guide.payload as TissGuidePayload;

  return (
    <div className="max-w-3xl mx-auto p-8 print:p-4 bg-white text-black">
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none; }
        }
      `}</style>
      <PrintButton />
      <header className="border-b-2 border-black pb-2 mb-4">
        <h1 className="text-lg font-bold">GUIA TISS — {guide.guideType.replace("_", " ")}</h1>
        <p className="text-sm">Operadora: {guide.healthInsurer.name} (ANS {guide.ansRegistration})</p>
        <p className="text-sm">Guia prestador: #{guide.guideNumber}</p>
      </header>
      <section className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <h2 className="font-semibold border-b mb-1">Beneficiário</h2>
          <p>{payload.dadosBeneficiario.nomeBeneficiario}</p>
          <p>Carteira: {payload.dadosBeneficiario.numeroCarteira}</p>
          {payload.dadosBeneficiario.validadeCarteira && (
            <p>Validade: {payload.dadosBeneficiario.validadeCarteira}</p>
          )}
        </div>
        <div>
          <h2 className="font-semibold border-b mb-1">Executante</h2>
          <p>{payload.profissionalExecutante.nomeProfissional}</p>
          <p>
            Conselho: {payload.profissionalExecutante.conselhoProfissional}{" "}
            {payload.profissionalExecutante.numeroConselho}/{payload.profissionalExecutante.ufConselho}
          </p>
        </div>
      </section>
      <section className="text-sm mb-4">
        <h2 className="font-semibold border-b mb-1">Atendimento</h2>
        <p>Data: {payload.dataAtendimento} {payload.horaAtendimento}</p>
        <p>Caráter: {payload.caraterAtendimento} · Acidente: {payload.indicacaoAcidente}</p>
        {payload.cid10 && <p>CID: {payload.cid10}</p>}
        {payload.senhaAutorizacao && <p>Senha: {payload.senhaAutorizacao}</p>}
      </section>
      <table className="w-full text-sm border-collapse border border-black">
        <thead>
          <tr className="bg-zinc-100">
            <th className="border border-black p-1 text-left">TUSS</th>
            <th className="border border-black p-1 text-left">Procedimento</th>
            <th className="border border-black p-1 text-right">Qtd</th>
            <th className="border border-black p-1 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {payload.procedimentos.map((p) => (
            <tr key={p.tussCode}>
              <td className="border border-black p-1">{p.tussCode}</td>
              <td className="border border-black p-1">{p.term}</td>
              <td className="border border-black p-1 text-right">{p.quantity}</td>
              <td className="border border-black p-1 text-right">{formatBRL(p.totalValueCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="border border-black p-1 text-right font-semibold">Total</td>
            <td className="border border-black p-1 text-right font-semibold">
              {formatBRL(guide.totalValueCents)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
