import { adminPrisma } from "@/lib/db/admin-client";
import { ensureSubscription } from "@/modules/admin/services/subscription.service";
import { getStripeClient } from "./stripe-client";

export async function getOrCreateStripeCustomer(
  organizationId: string,
): Promise<string> {
  await ensureSubscription(organizationId);

  const sub = await adminPrisma.subscription.findUnique({
    where: { organizationId },
    select: { externalCustomerId: true },
  });
  if (sub?.externalCustomerId) return sub.externalCustomerId;

  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: organizationId },
    select: { name: true, email: true },
  });

  const owner = await adminPrisma.membership.findFirst({
    where: { organizationId, role: "OWNER", deletedAt: null },
    include: { user: { select: { email: true, name: true } } },
  });

  const customer = await getStripeClient().customers.create({
    email: org.email ?? owner?.user.email ?? undefined,
    name: org.name,
    metadata: { organizationId, planKind: "vital8_saas" },
  });

  await adminPrisma.subscription.update({
    where: { organizationId },
    data: { externalCustomerId: customer.id },
  });

  return customer.id;
}
