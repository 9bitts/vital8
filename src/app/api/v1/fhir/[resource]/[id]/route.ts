import { getFhirHandler } from "@/modules/api/handlers/fhir.handler";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  const { resource, id } = await params;
  return getFhirHandler(resource)(req as import("next/server").NextRequest, {
    params: Promise.resolve({ id }),
  });
}
