"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { respondToConfirmationAction } from "@/modules/scheduling/actions/confirmation.actions";

type Props = {
  token: string;
  appointmentInfo?: {
    serviceName: string;
    professionalName: string;
    startsAt: string;
  } | null;
};

export function ConfirmationForm({ token, appointmentInfo }: Props) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function respond(response: "confirm" | "cancel") {
    startTransition(async () => {
      const result = await respondToConfirmationAction(token, response);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setDone(response === "confirm" ? "Confirmado!" : "Cancelado.");
    });
  }

  if (done) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center shadow">
        <p className="text-lg font-medium text-emerald-700">{done}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-8 shadow">
      {appointmentInfo && (
        <div className="mb-6 text-center">
          <p className="text-sm text-zinc-500">Sua consulta</p>
          <p className="text-xl font-semibold">{appointmentInfo.serviceName}</p>
          <p className="text-zinc-600">{appointmentInfo.professionalName}</p>
          <p className="text-zinc-600">
            {new Date(appointmentInfo.startsAt).toLocaleString("pt-BR")}
          </p>
        </div>
      )}
      <div className="flex justify-center gap-4">
        <Button
          size="lg"
          disabled={pending}
          onClick={() => respond("confirm")}
        >
          Confirmar presença
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={pending}
          onClick={() => respond("cancel")}
        >
          Cancelar
        </Button>
      </div>
      {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
