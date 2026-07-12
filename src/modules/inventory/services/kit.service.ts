import type { TenantClient } from "@/lib/db/tenant-client";
import { consumeFEFO } from "./movement.service";
import { resolveLocationForRoom } from "./location.service";

export async function getKitForService(db: TenantClient, serviceId: string) {
  return db.serviceConsumptionKit.findFirst({
    where: { serviceId },
    include: { items: { include: { product: true } } },
  });
}

export async function saveServiceKit(
  db: TenantClient,
  organizationId: string,
  serviceId: string,
  items: Array<{ productId: string; quantity: number }>,
) {
  const existing = await db.serviceConsumptionKit.findFirst({
    where: { serviceId },
  });

  const kit = existing
    ? await db.serviceConsumptionKit.update({
        where: { id: existing.id },
        data: {},
      })
    : await db.serviceConsumptionKit.create({
        data: { organizationId, serviceId },
      });

  await db.serviceConsumptionKitItem.deleteMany({ where: { kitId: kit.id } });
  if (items.length > 0) {
    await db.serviceConsumptionKitItem.createMany({
      data: items.map((i) => ({
        organizationId,
        kitId: kit.id,
        productId: i.productId,
        quantity: i.quantity,
      })),
    });
  }

  return db.serviceConsumptionKit.findFirstOrThrow({
    where: { id: kit.id },
    include: { items: { include: { product: true } } },
  });
}

export type PendingConsumption = {
  productId: string;
  productName: string;
  quantity: number;
};

export async function previewAppointmentConsumption(
  db: TenantClient,
  appointmentId: string,
): Promise<PendingConsumption[]> {
  const appt = await db.appointment.findFirstOrThrow({
    where: { id: appointmentId },
    include: { service: true },
  });
  const kit = await getKitForService(db, appt.serviceId);
  if (!kit) return [];
  return kit.items.map((i) => ({
    productId: i.productId,
    productName: i.product.name,
    quantity: i.quantity,
  }));
}

export async function consumeKitForAppointment(
  db: TenantClient,
  organizationId: string,
  userId: string,
  appointmentId: string,
  overrides?: Array<{ productId: string; quantity: number }>,
) {
  const appt = await db.appointment.findFirstOrThrow({
    where: { id: appointmentId },
    include: { encounter: true, service: true },
  });

  const kit = await getKitForService(db, appt.serviceId);
  if (!kit || kit.items.length === 0) return [];

  const location = await resolveLocationForRoom(db, appt.roomId);
  const items =
    overrides ??
    kit.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));

  const movements = [];
  for (const item of items) {
    if (item.quantity <= 0) continue;
    const movs = await consumeFEFO(db, organizationId, {
      movementType: "SAIDA_CONSUMO",
      productId: item.productId,
      locationId: location.id,
      quantityNeeded: item.quantity,
      userId,
      appointmentId,
      encounterId: appt.encounter?.id ?? null,
    });
    movements.push(...movs);
  }
  return movements;
}
