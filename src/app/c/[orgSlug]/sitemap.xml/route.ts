import { adminPrisma } from "@/lib/db/admin-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  const { orgSlug } = await params;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const org = await adminPrisma.organization.findFirst({
    where: { slug: orgSlug, isActive: true, deletedAt: null },
    select: { id: true, slug: true, updatedAt: true },
  });

  if (!org) {
    return new Response("Not found", { status: 404 });
  }

  const publishedLandings = await adminPrisma.landingPage.findMany({
    where: { organizationId: org.id, published: true },
    select: { slug: true, updatedAt: true },
  });

  const urls = [
    { loc: `${base}/c/${org.slug}`, lastmod: org.updatedAt.toISOString() },
    { loc: `${base}/agendar/${org.slug}`, lastmod: org.updatedAt.toISOString() },
    ...publishedLandings.map((lp) => ({
      loc: `${base}/lp/${org.slug}/${lp.slug}`,
      lastmod: lp.updatedAt.toISOString(),
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
