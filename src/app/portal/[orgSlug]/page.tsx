import { PortalHome } from "@/modules/engagement/components/portal-home";

type Props = { params: { orgSlug: string } };

export default function PortalPage({ params }: Props) {
  return (
    <main className="min-h-screen bg-zinc-50 py-10">
      <PortalHome orgSlug={params.orgSlug} />
    </main>
  );
}
