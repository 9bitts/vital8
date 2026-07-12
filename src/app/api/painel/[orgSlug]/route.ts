import { NextResponse } from "next/server";
import { getPanelDataAction } from "@/modules/scheduling/actions/reception.actions";

type Props = {
  params: { orgSlug: string };
};

export async function GET(_request: Request, { params }: Props) {
  const data = await getPanelDataAction(params.orgSlug);

  if (!data) {
    return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    orgName: data.orgName,
    calls: data.calls.map((c) => ({
      ...c,
      calledAt: c.calledAt?.toISOString() ?? null,
    })),
  });
}
