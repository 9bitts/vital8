import { NpsForm } from "@/modules/engagement/components/nps-form";

type Props = { params: { token: string } };

export default function NpsPage({ params }: Props) {
  return (
    <main className="min-h-screen bg-zinc-50 py-10 px-4">
      <NpsForm token={params.token} />
    </main>
  );
}
