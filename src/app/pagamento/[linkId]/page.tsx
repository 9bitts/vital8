import { getPaymentsAdapter } from "@/lib/integrations/payments";

type Props = { params: { linkId: string } };

export default async function PaymentLinkPage({ params }: Props) {
  const status = await getPaymentsAdapter().getStatus(params.linkId);

  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="text-xl font-semibold mb-4">Pagamento Vital8</h1>
      <p className="text-sm text-zinc-600">Link: {params.linkId}</p>
      <p className="mt-4 text-lg">
        Status:{" "}
        <span className="font-medium">
          {status === "PENDING"
            ? "Aguardando pagamento"
            : status === "PAID"
              ? "Pago"
              : "Expirado"}
        </span>
      </p>
    </div>
  );
}
