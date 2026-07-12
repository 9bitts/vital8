import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";

export default async function MobilePatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuth();
  const patient = await ctx.db.patient.findFirst({
    where: { id },
    include: {
      allergies: { select: { substance: true, severity: true } },
      appointments: {
        take: 10,
        orderBy: { startsAt: "desc" },
        select: { id: true, startsAt: true, status: true, service: { select: { name: true } } },
      },
    },
  });
  if (!patient) notFound();

  return (
    <div className="space-y-4">
      <Link href="/m/pacientes" className="text-sm text-blue-600 dark:text-blue-400">
        ← Voltar
      </Link>
      <header>
        <h2 className="text-lg font-semibold">{patient.socialName ?? patient.fullName}</h2>
        {patient.allergies.length > 0 && (
          <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            Alergias: {patient.allergies.map((a) => a.substance).join(", ")}
          </div>
        )}
      </header>

      <div className="flex gap-2">
        <a
          href="tel:"
          className="flex min-h-11 flex-1 items-center justify-center rounded-md border dark:border-zinc-700"
        >
          Telefonar
        </a>
        <a
          href="https://wa.me/"
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 flex-1 items-center justify-center rounded-md border dark:border-zinc-700"
        >
          WhatsApp
        </a>
      </div>

      <section>
        <h3 className="mb-2 font-medium">Linha do tempo</h3>
        <ul className="space-y-2 text-sm">
          {patient.appointments.map((a) => (
            <li key={a.id} className="rounded-lg border px-3 py-2 dark:border-zinc-800">
              {new Date(a.startsAt).toLocaleDateString("pt-BR")} — {a.service.name} ({a.status})
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-zinc-500">
        Conteúdo clínico (prontuário) disponível apenas online em /app — nunca em cache offline.
      </p>
      <Link
        href={`/app/pacientes/${patient.id}`}
        className="block min-h-11 rounded-md bg-blue-600 px-4 py-3 text-center text-sm text-white"
      >
        Abrir prontuário (online)
      </Link>
    </div>
  );
}
