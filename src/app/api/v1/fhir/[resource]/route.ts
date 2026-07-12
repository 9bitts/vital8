import { listFhirHandler } from "@/modules/api/handlers/fhir.handler";

export const dynamic = "force-dynamic";

const SUPPORTED = [
  "Patient",
  "Appointment",
  "Encounter",
  "DiagnosticReport",
  "ServiceRequest",
  "Practitioner",
] as const;

type Resource = (typeof SUPPORTED)[number];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const { resource } = await params;
  if (!SUPPORTED.includes(resource as Resource)) {
    return new Response(JSON.stringify({ error: "Recurso FHIR não suportado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return listFhirHandler(resource)(req as import("next/server").NextRequest);
}
