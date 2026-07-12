"use server";

import { revalidatePath } from "next/cache";
import {
  AuthError,
  requireAuth,
  type ActionResult,
  mapAuthError,
} from "@/lib/auth/guards";
import { hasOrgFeature } from "@/lib/features/subscription.service";
import {
  canManageLandingPages,
  canManageMarketing,
  canOperateLeads,
} from "../lib/permissions";
import {
  leadCreateSchema,
  leadInteractionSchema,
  leadStatusSchema,
  landingPageSchema,
  marketingCampaignSchema,
} from "../schemas/marketing.schema";
import {
  addLeadInteraction,
  createLead,
  listLeads,
  updateLeadStatus,
} from "../services/lead.service";
import { convertLeadToPatient } from "../services/lead-conversion.service";
import {
  createLandingPage,
  publishLandingPage,
} from "../services/landing-page.service";
import { getMarketingDashboard } from "../services/roi.service";
import {
  approveTestimonial,
  publishTestimonial,
  requestTestimonial,
} from "../services/reputation.service";
import {
  createReferral,
  getOrCreateReferralProgram,
} from "../services/referral.service";
import { scheduleNewLeadCadence } from "../services/lead-cadence.service";

async function requireMarketing() {
  const ctx = await requireAuth();
  const ok = await hasOrgFeature(ctx.organizationId, "marketing");
  if (!ok) throw new AuthError("Marketing disponível em PRO/ENTERPRISE", "FORBIDDEN");
  return ctx;
}

export async function listLeadsAction(filters?: {
  status?: string;
  leadSourceId?: string;
  marketingCampaignId?: string;
}) {
  const ctx = await requireMarketing();
  if (!canOperateLeads(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
  return listLeads(ctx.db, ctx.organizationId, {
    branchId: ctx.branchId,
    status: filters?.status as never,
    leadSourceId: filters?.leadSourceId,
    marketingCampaignId: filters?.marketingCampaignId,
  });
}

export async function createLeadAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireMarketing();
    if (!canOperateLeads(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    const parsed = leadCreateSchema.parse(input);
    if (!parsed.marketingConsent) {
      return { success: false, error: "Consentimento de marketing obrigatório" };
    }
    const lead = await createLead(ctx.db, ctx.organizationId, {
      ...parsed,
      marketingConsentAt: new Date(),
      assignedUserId: parsed.assignedUserId ?? ctx.userId,
    });
    await scheduleNewLeadCadence(ctx.db, ctx.organizationId, lead.id);
    revalidatePath("/app/marketing/leads");
    return { success: true, data: { id: lead.id } };
  } catch (e) {
    return mapAuthError(e) as ActionResult<{ id: string }>;
  }
}

export async function updateLeadStatusAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireMarketing();
    if (!canOperateLeads(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    const parsed = leadStatusSchema.parse(input);
    await updateLeadStatus(ctx.db, parsed.leadId, parsed.status, parsed.lossReason);
    revalidatePath("/app/marketing/leads");
    return { success: true };
  } catch (e) {
    return mapAuthError(e);
  }
}

export async function addLeadInteractionAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireMarketing();
    if (!canOperateLeads(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    const parsed = leadInteractionSchema.parse(input);
    await addLeadInteraction(
      ctx.db,
      ctx.organizationId,
      parsed.leadId,
      ctx.userId,
      parsed.type,
      parsed.notes,
    );
    revalidatePath("/app/marketing/leads");
    return { success: true };
  } catch (e) {
    return mapAuthError(e);
  }
}

export async function convertLeadAction(
  leadId: string,
  options?: { cpf?: string },
): Promise<ActionResult<{ patientId: string }>> {
  try {
    const ctx = await requireMarketing();
    if (!canOperateLeads(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    const result = await convertLeadToPatient(ctx.db, ctx.organizationId, leadId, options);
    revalidatePath("/app/marketing/leads");
    revalidatePath("/app/pacientes");
    return { success: true, data: { patientId: result.patientId } };
  } catch (e) {
    return mapAuthError(e) as ActionResult<{ patientId: string }>;
  }
}

export async function getMarketingDashboardAction() {
  const ctx = await requireMarketing();
  if (!canManageMarketing(ctx.role) && !canOperateLeads(ctx.role)) {
    throw new AuthError("Permissão insuficiente", "FORBIDDEN");
  }
  return getMarketingDashboard(ctx.db, ctx.organizationId);
}

export async function createLandingPageAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireMarketing();
    if (!canManageLandingPages(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    const parsed = landingPageSchema.parse(input);
    const page = await createLandingPage(ctx.db, ctx.organizationId, parsed);
    revalidatePath("/app/marketing/landing-pages");
    return { success: true, data: { id: page.id } };
  } catch (e) {
    return mapAuthError(e) as ActionResult<{ id: string }>;
  }
}

export async function publishLandingPageAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireMarketing();
    if (!canManageLandingPages(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    await publishLandingPage(ctx.db, id);
    revalidatePath("/app/marketing/landing-pages");
    return { success: true };
  } catch (e) {
    return mapAuthError(e);
  }
}

export async function createCampaignAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireMarketing();
    if (!canManageMarketing(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    const parsed = marketingCampaignSchema.parse(input);
    const campaign = await ctx.db.marketingCampaign.create({
      data: {
        organizationId: ctx.organizationId,
        name: parsed.name,
        leadSourceId: parsed.leadSourceId ?? null,
        channel: parsed.channel,
        periodStart: new Date(parsed.periodStart),
        periodEnd: new Date(parsed.periodEnd),
        investmentCents: parsed.investmentCents,
        utmSource: parsed.utmSource ?? null,
        utmMedium: parsed.utmMedium ?? null,
        utmCampaign: parsed.utmCampaign ?? null,
      },
    });
    revalidatePath("/app/marketing/campanhas");
    return { success: true, data: { id: campaign.id } };
  } catch (e) {
    return mapAuthError(e) as ActionResult<{ id: string }>;
  }
}

export async function listLeadSourcesAction() {
  const ctx = await requireMarketing();
  return ctx.db.leadSource.findMany({
    where: { organizationId: ctx.organizationId, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function listLandingPagesAction() {
  const ctx = await requireMarketing();
  return ctx.db.landingPage.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listTestimonialsAction() {
  const ctx = await requireMarketing();
  return ctx.db.testimonial.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function approveTestimonialAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireMarketing();
    if (!canManageMarketing(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    await approveTestimonial(ctx.organizationId, id, ctx.userId);
    revalidatePath("/app/marketing/depoimentos");
    return { success: true };
  } catch (e) {
    return mapAuthError(e);
  }
}

export async function publishTestimonialAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireMarketing();
    if (!canManageLandingPages(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    await publishTestimonial(id);
    revalidatePath("/app/marketing/depoimentos");
    return { success: true };
  } catch (e) {
    return mapAuthError(e);
  }
}

export async function getReferralProgramAction() {
  const ctx = await requireMarketing();
  if (!canManageLandingPages(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
  return getOrCreateReferralProgram(ctx.db, ctx.organizationId);
}

export async function createReferralAction(
  referrerPatientId: string,
  referredLeadId?: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireMarketing();
    if (!canManageLandingPages(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    const ref = await createReferral(
      ctx.db,
      ctx.organizationId,
      referrerPatientId,
      referredLeadId,
    );
    return { success: true, data: { id: ref.id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function requestTestimonialAction(patientId: string, authorName: string) {
  const ctx = await requireMarketing();
  if (!canManageMarketing(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
  return requestTestimonial(ctx.organizationId, patientId, authorName);
}
