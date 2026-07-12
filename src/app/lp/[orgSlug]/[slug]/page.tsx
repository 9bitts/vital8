import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminPrisma } from "@/lib/db/admin-client";
import { getPublishedLanding } from "@/modules/marketing/services/landing-page.service";
import { PublicLeadForm } from "@/modules/marketing/components/public-lead-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string }>;
}): Promise<Metadata> {
  const { orgSlug, slug } = await params;
  const org = await adminPrisma.organization.findFirst({
    where: { slug: orgSlug, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!org) return { title: "Landing" };
  const page = await getPublishedLanding(org.id, slug);
  if (!page) return { title: org.name };
  return {
    title: page.title,
    description: page.metaDescription ?? undefined,
    openGraph: {
      title: page.title,
      description: page.metaDescription ?? undefined,
      type: "website",
      ...(page.ogImageUrl ? { images: [{ url: page.ogImageUrl }] } : {}),
    },
  };
}

export default async function PublicLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgSlug, slug } = await params;
  const utm = await searchParams;

  const org = await adminPrisma.organization.findFirst({
    where: { slug: orgSlug, isActive: true, deletedAt: null },
    select: { id: true, name: true, plan: true },
  });
  if (!org) notFound();

  const page = await getPublishedLanding(org.id, slug);
  if (!page) notFound();

  const blocks = page.blocks as Array<Record<string, unknown>>;

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b px-6 py-8">
        <p className="text-sm text-zinc-500">{org.name}</p>
        <h1 className="text-3xl font-semibold">{page.title}</h1>
        {page.metaDescription && (
          <p className="mt-2 text-zinc-600">{page.metaDescription}</p>
        )}
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-8">
        {blocks.map((block, i) => {
          if (block.type === "hero") {
            return (
              <section key={i} className="space-y-4">
                <h2 className="text-2xl font-medium">{block.headline as string}</h2>
                <p>{block.subheadline as string}</p>
              </section>
            );
          }
          if (block.type === "form") {
            return (
              <section key={i} id="form">
                <h2 className="mb-4 text-xl font-medium">{block.title as string}</h2>
                <PublicLeadForm
                  orgSlug={orgSlug}
                  consentText={block.consentText as string}
                  utm={utm}
                />
              </section>
            );
          }
          if (block.type === "faq") {
            const items = (block.items as Array<{ q: string; a: string }>) ?? [];
            return (
              <section key={i}>
                <h2 className="mb-2 text-xl font-medium">{block.title as string}</h2>
                <ul className="space-y-2 text-sm">
                  {items.map((item, j) => (
                    <li key={j}>
                      <strong>{item.q}</strong>
                      <p className="text-zinc-600">{item.a}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          }
          return null;
        })}
        <p className="text-xs text-zinc-500">
          Informações de saúde sem promessa de resultado. Consulte sempre um profissional.
        </p>
      </main>
    </div>
  );
}
