import { PublicCallingPanel } from "@/modules/scheduling/components/public-calling-panel";

type Props = {
  params: { orgSlug: string };
};

export default function PainelPage({ params }: Props) {
  return <PublicCallingPanel orgSlug={params.orgSlug} />;
}
