import { verifyByCode } from "@/modules/emr/services/verify.service";
import Link from "next/link";

type Props = { params: { codigo: string } };

export default async function VerificarPage({ params }: Props) {
  const result = await verifyByCode(params.codigo);

  return (
    <main className="min-h-screen bg-zinc-50 py-12">
      <div className="mx-auto max-w-lg rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold">Verificação de documento</h1>
          <p className="text-sm text-zinc-500">Vital8 — validação pública sem dados clínicos</p>
        </div>

        {!result ? (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
            Código <strong>{params.codigo}</strong> não encontrado ou inválido.
          </div>
        ) : (
          <dl className="space-y-3 text-sm">
            <div className="rounded-md bg-green-50 p-3 text-green-800 font-medium">
              Documento verificado com sucesso
            </div>
            <div>
              <dt className="text-zinc-500">Código</dt>
              <dd className="font-mono">{result.verificationCode}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Tipo</dt>
              <dd>{result.entityTypeLabel}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Organização</dt>
              <dd>{result.organizationName}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Assinante</dt>
              <dd>{result.signerName}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Data da assinatura</dt>
              <dd>{result.signedAt.toLocaleString("pt-BR")}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Método</dt>
              <dd>{result.signatureMethodLabel}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Carimbo de tempo</dt>
              <dd>{result.hasTimestamp ? "Presente" : "Não informado"}</dd>
            </div>
            {result.timestampToken && (
              <div>
                <dt className="text-zinc-500">Token ACT (parcial)</dt>
                <dd className="font-mono text-xs">{result.timestampToken}</dd>
              </div>
            )}
            <div>
              <dt className="text-zinc-500">Hash SHA-256 do conteúdo</dt>
              <dd className="font-mono text-xs break-all">{result.contentHash}</dd>
            </div>
          </dl>
        )}

        <p className="mt-6 text-center text-xs text-zinc-400">
          Esta página não exibe conteúdo clínico nem dados do paciente.
        </p>
        <p className="mt-2 text-center">
          <Link href="/" className="text-sm underline text-zinc-600">
            Voltar ao início
          </Link>
        </p>
      </div>
    </main>
  );
}
