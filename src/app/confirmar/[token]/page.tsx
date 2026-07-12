import { ConfirmationForm } from "@/modules/scheduling/components/confirmation-form";
import { getConfirmationDetailsAction } from "@/modules/scheduling/actions/confirmation.actions";

type Props = {
  params: { token: string };
};

export default async function ConfirmarPage({ params }: Props) {
  const info = await getConfirmationDetailsAction(params.token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-semibold">Vital8</h1>
        {info ? (
          <ConfirmationForm token={params.token} appointmentInfo={info} />
        ) : (
          <div className="rounded-lg border bg-white p-8 text-center shadow">
            <p className="text-zinc-600">
              Link inválido, expirado ou já respondido.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
