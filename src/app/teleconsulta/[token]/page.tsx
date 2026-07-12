import { TeleconsultConsentClient } from "@/modules/engagement/components/teleconsult-consent-client";

type Props = { params: { token: string } };

export default function TeleconsultaPage({ params }: Props) {
  return (
    <main className="min-h-screen bg-zinc-50 py-6">
      <TeleconsultConsentClient token={params.token} />
    </main>
  );
}
