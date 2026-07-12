"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  acceptTeleconsultConsentAction,
  getTeleconsultConsentAction,
} from "@/modules/engagement/actions/portal.actions";

type Props = { token: string };

export function TeleconsultConsentClient({ token }: Props) {
  const [data, setData] = useState<
    Awaited<ReturnType<typeof getTeleconsultConsentAction>>
  >(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getTeleconsultConsentAction(token).then(setData);
  }, [token]);

  if (!data) return <p className="p-6 text-sm">Carregando…</p>;

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-semibold">Consentimento — Teleconsulta</h1>
      <p className="text-sm">
        {data.patientName} — {data.serviceName} com {data.professionalName}
      </p>
      <pre className="whitespace-pre-wrap rounded border bg-white p-3 text-xs">
        {data.termText}
      </pre>
      {data.accepted ? (
        <p className="text-green-700 text-sm">Termo já aceito. Obrigado.</p>
      ) : (
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await acceptTeleconsultConsentAction(token);
              setData(await getTeleconsultConsentAction(token));
            })
          }
        >
          Aceito os termos
        </Button>
      )}
    </div>
  );
}
