import { notFound } from "next/navigation";
import Link from "next/link";
import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";

export default async function ClinicMiniSitePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await adminPrisma.organization.findFirst({
    where: { slug: orgSlug, isActive: true, deletedAt: null },
    select: { id: true, name: true, slug: true },
  });
  if (!org) notFound();

  const db = createTenantClient(org.id);
  const [services, professionals, branches] = await Promise.all([
    db.service.findMany({ where: { isActive: true }, take: 12, select: { name: true } }),
    db.professional.findMany({
      where: { isActive: true },
      take: 8,
      select: { displayName: true, councilType: true, councilNumber: true, specialties: true },
    }),
    db.branch.findMany({ where: { isActive: true }, take: 5, select: { name: true } }),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: org.name,
    url: `/c/${org.slug}`,
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b px-6 py-10">
        <h1 className="text-3xl font-semibold">{org.name}</h1>
        <p className="mt-2 text-zinc-600">Cuidado integrado e acolhimento</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/agendar/${org.slug}`}
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            Agendar online
          </Link>
          <a
            href="https://wa.me/"
            className="rounded border px-4 py-2"
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-10 px-6 py-8">
        <section>
          <h2 className="text-xl font-medium">Serviços</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {services.map((s) => (
              <li key={s.name}>
                <strong>{s.name}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-medium">Profissionais</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {professionals.map((p) => (
              <li key={p.displayName}>
                {p.displayName}
                {p.councilType && (
                  <span className="text-zinc-500">
                    {" "}
                    · {p.councilType} {p.councilNumber}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-medium">Unidades</h2>
          <ul className="mt-2 text-sm">
            {branches.map((b) => (
              <li key={b.name}>{b.name}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
