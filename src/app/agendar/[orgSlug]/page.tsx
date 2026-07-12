import { OnlineBookingWizard } from "@/modules/engagement/components/online-booking-wizard";

type Props = { params: { orgSlug: string } };

export default function AgendarPage({ params }: Props) {
  return (
    <main className="min-h-screen bg-zinc-50 py-10 px-4">
      <OnlineBookingWizard orgSlug={params.orgSlug} />
    </main>
  );
}

export function generateMetadata() {
  return { title: "Agendar consulta — Vital8" };
}
