import { getPaymentLinkDetails } from "@/lib/integrations/payments";
import { CopyPixButton } from "@/modules/finance/components/copy-pix-button";

type Props = { params: { linkId: string } };

export default async function PaymentLinkPage({ params }: Props) {
  const link = await getPaymentLinkDetails(params.linkId);

  if (!link) {
    return (
      <div className="mx-auto max-w-md p-8">
        <h1 className="text-xl font-semibold mb-4">Pagamento Vital8</h1>
        <p className="text-zinc-600">Link inválido ou expirado.</p>
      </div>
    );
  }

  const statusLabel =
    link.status === "PENDING"
      ? "Aguardando pagamento"
      : link.status === "PAID"
        ? "Pago"
        : "Expirado";

  return (
    <div className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-xl font-semibold">Pagamento Vital8</h1>
      <p className="text-sm text-zinc-600">{link.description}</p>
      <p className="text-2xl font-semibold">
        R$ {(link.amountCents / 100).toFixed(2)}
      </p>
      <p className="text-lg">
        Status: <span className="font-medium">{statusLabel}</span>
      </p>

      {link.status === "PENDING" && link.pixCopyPaste && (
        <div className="space-y-3 rounded-lg border p-4">
          {link.pixQrCodeBase64 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${link.pixQrCodeBase64}`}
              alt="QR Code PIX"
              className="mx-auto h-48 w-48"
            />
          )}
          <p className="text-xs text-zinc-500 break-all font-mono">
            {link.pixCopyPaste}
          </p>
          <CopyPixButton code={link.pixCopyPaste} />
        </div>
      )}

      {link.status === "PAID" && link.paidAt && (
        <p className="text-sm text-green-700">
          Pagamento confirmado em {link.paidAt.toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}
