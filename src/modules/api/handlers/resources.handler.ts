import { adminPrisma } from "@/lib/db/admin-client";
import { logRecordAccess } from "@/modules/emr/services/record-access.service";
import { decryptPHI } from "@/lib/crypto/phi";
import { apiSuccess, decodeCursor, encodeCursor, parseLimit } from "../lib/response";
import { notFound } from "../lib/errors";
import type { ApiContext } from "../middleware/authenticate";

export async function getOrganization(ctx: ApiContext) {
  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: ctx.organizationId },
    include: { branches: { where: { isActive: true }, select: { id: true, name: true, isMain: true } } },
  });
  return apiSuccess({
    id: org.id,
    name: org.name,
    slug: org.slug,
    type: org.type,
    branches: org.branches,
  });
}

export async function listProfessionals(req: Request, ctx: ApiContext) {
  const limit = parseLimit(new URL(req.url).searchParams.get("limit"));
  const rows = await ctx.db.professional.findMany({
    where: { isActive: true },
    take: limit,
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      specialties: true,
      councilType: true,
      councilNumber: true,
      councilState: true,
    },
  });
  return apiSuccess(rows);
}

export async function listServices(req: Request, ctx: ApiContext) {
  const limit = parseLimit(new URL(req.url).searchParams.get("limit"));
  const rows = await ctx.db.service.findMany({
    where: { isActive: true },
    take: limit,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      privatePrice: true,
      isTeleconsult: true,
      allowOnlineBooking: true,
    },
  });
  return apiSuccess(rows);
}

export async function listEncounters(req: Request, ctx: ApiContext) {
  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursorRaw = url.searchParams.get("cursor");
  const where: Record<string, unknown> = {};
  if (cursorRaw) {
    const c = decodeCursor(cursorRaw);
    if (c) where.id = { gt: c.id };
  }
  const rows = await ctx.db.encounter.findMany({
    where,
    orderBy: { id: "asc" },
    take: limit + 1,
    select: {
      id: true,
      patientId: true,
      professionalId: true,
      appointmentId: true,
      status: true,
      signedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return apiSuccess(
    page.map((e) => ({
      ...e,
      signedAt: e.signedAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    {
      limit,
      hasMore,
      cursor: hasMore && last ? encodeCursor(last.id, last.updatedAt) : null,
    },
  );
}

export async function getEncounter(ctx: ApiContext, id: string, req: Request) {
  const encounter = await ctx.db.encounter.findFirst({
    where: { id },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      prescriptions: { select: { id: true, signedAt: true, type: true } },
      certificates: { select: { id: true, signedAt: true } },
    },
  });
  if (!encounter) throw notFound("Atendimento");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await logRecordAccess({
    organizationId: ctx.organizationId,
    userId: null,
    resourceType: "ENCOUNTER",
    resourceId: id,
    action: "api.read",
    ipAddress: ip,
    metadata: { via: `api:${ctx.clientName}`, patientId: encounter.patientId },
  });

  const includeClinical = ctx.clinicalAccessEnabled;

  return apiSuccess({
    id: encounter.id,
    patientId: encounter.patientId,
    professionalId: encounter.professionalId,
    appointmentId: encounter.appointmentId,
    status: encounter.status,
    signedAt: encounter.signedAt?.toISOString() ?? null,
    createdAt: encounter.createdAt.toISOString(),
    updatedAt: encounter.updatedAt.toISOString(),
    sections: includeClinical
      ? encounter.sections.map((s) => ({
          id: s.id,
          sectionType: s.sectionType,
          content: s.contentEncrypted ? decryptPHI(s.contentEncrypted) : null,
        }))
      : undefined,
    prescriptions: encounter.prescriptions.map((p) => ({
      id: p.id,
      signedAt: p.signedAt?.toISOString() ?? null,
      type: p.type,
    })),
    certificates: encounter.certificates.map((c) => ({
      id: c.id,
      signedAt: c.signedAt?.toISOString() ?? null,
    })),
  });
}

export async function listReceivables(req: Request, ctx: ApiContext) {
  const limit = parseLimit(new URL(req.url).searchParams.get("limit"));
  const rows = await ctx.db.receivable.findMany({
    take: limit,
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      patientId: true,
      description: true,
      totalCents: true,
      dueDate: true,
      status: true,
      createdAt: true,
    },
  });
  return apiSuccess(
    rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      description: r.description,
      totalCents: r.totalCents,
      dueDate: r.dueDate.toISOString().slice(0, 10),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  );
}

export async function listPayments(req: Request, ctx: ApiContext) {
  const limit = parseLimit(new URL(req.url).searchParams.get("limit"));
  const rows = await ctx.db.payment.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      receivableId: true,
      amountCents: true,
      method: true,
      createdAt: true,
    },
  });
  return apiSuccess(
    rows.map((p) => ({
      id: p.id,
      receivableId: p.receivableId,
      amountCents: p.amountCents,
      method: p.method,
      createdAt: p.createdAt.toISOString(),
    })),
  );
}

export async function listSales(req: Request, ctx: ApiContext) {
  const limit = parseLimit(new URL(req.url).searchParams.get("limit"));
  const rows = await ctx.db.sale.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      patientId: true,
      totalCents: true,
      status: true,
      createdAt: true,
    },
  });
  return apiSuccess(
    rows.map((s) => ({
      id: s.id,
      patientId: s.patientId,
      totalCents: s.totalCents,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
    })),
  );
}

export async function listInsurers(req: Request, ctx: ApiContext) {
  const limit = parseLimit(new URL(req.url).searchParams.get("limit"));
  const rows = await ctx.db.healthInsurer.findMany({
    where: { isActive: true },
    take: limit,
    orderBy: { name: "asc" },
    select: { id: true, name: true, ansRegistration: true },
  });
  return apiSuccess(rows);
}

export async function listProducts(req: Request, ctx: ApiContext) {
  const limit = parseLimit(new URL(req.url).searchParams.get("limit"));
  const products = await ctx.db.product.findMany({
    where: { isActive: true },
    take: limit,
    orderBy: { name: "asc" },
    select: { id: true, name: true, purchaseUnit: true, consumeUnit: true, barcode: true },
  });
  const balances = await ctx.db.stockBalance.findMany({
    where: { productId: { in: products.map((p) => p.id) } },
    select: { productId: true, quantity: true, locationId: true },
  });
  return apiSuccess(
    products.map((p) => ({
      ...p,
      balances: balances
        .filter((b) => b.productId === p.id)
        .map((b) => ({ locationId: b.locationId, quantity: b.quantity })),
    })),
  );
}
