import type { TenantClient } from "@/lib/db/tenant-client";
import { adminPrisma } from "@/lib/db/admin-client";
import { SUBSCRIPTION_PLAN_LIMITS } from "@/lib/features/subscription-plans";
import type { SubscriptionPlan } from "@/generated/prisma/client";

export const DEFAULT_LANDING_BLOCKS = [
  {
    type: "hero",
    headline: "Cuidado humano, ciência e acolhimento",
    subheadline: "Agende sua consulta com nossa equipe",
    ctaLabel: "Quero agendar",
    ctaHref: "#form",
  },
  {
    type: "services",
    title: "Nossos serviços",
    items: [] as Array<{ name: string; description: string }>,
  },
  {
    type: "form",
    title: "Fale conosco",
    consentText:
      "Autorizo contato para informações sobre serviços (marketing). Posso revogar a qualquer momento.",
  },
  {
    type: "faq",
    title: "Perguntas frequentes",
    items: [
      {
        q: "Quais convênios atendem?",
        a: "Consulte nossa recepção para a lista atualizada.",
      },
    ],
  },
];

export async function countLandingPages(db: TenantClient, organizationId: string) {
  return db.landingPage.count({ where: { organizationId } });
}

export async function canCreateLandingPage(
  organizationId: string,
  plan: SubscriptionPlan,
) {
  const limit = SUBSCRIPTION_PLAN_LIMITS[plan].maxLandingPages ?? 3;
  const count = await adminPrisma.landingPage.count({ where: { organizationId } });
  return count < limit;
}

export async function createLandingPage(
  db: TenantClient,
  organizationId: string,
  input: {
    slug: string;
    title: string;
    metaDescription?: string;
    blocks?: unknown[];
    theme?: Record<string, unknown>;
  },
) {
  return db.landingPage.create({
    data: {
      organizationId,
      slug: input.slug,
      title: input.title,
      metaDescription: input.metaDescription ?? null,
      blocks: (input.blocks ?? DEFAULT_LANDING_BLOCKS) as object,
      theme: (input.theme ?? {}) as object,
    },
  });
}

export async function publishLandingPage(db: TenantClient, id: string) {
  return db.landingPage.update({
    where: { id },
    data: { published: true, publishedAt: new Date() },
  });
}

export async function getPublishedLanding(
  organizationId: string,
  slug: string,
) {
  return adminPrisma.landingPage.findFirst({
    where: { organizationId, slug, published: true },
  });
}
