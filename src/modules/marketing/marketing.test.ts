import { describe, expect, it, beforeEach, beforeAll, afterAll } from "vitest";
import {
  calculateCac,
  calculateLtv,
  calculateRoi,
  funnelStepRate,
} from "@/modules/marketing/services/roi.service";
import {
  shouldInviteGoogleReview,
  shouldNeverInviteGoogleReview,
} from "@/modules/marketing/services/reputation.service";
import { MockAdsAdapter } from "@/lib/integrations/ads/mock.adapter";
import { buildAdsUserData } from "@/modules/marketing/services/tracking.service";
import { exceedsReferralMonthlyLimit } from "@/modules/marketing/services/referral.service";
import { shouldSendLeadFollowUp } from "@/modules/marketing/services/lead-cadence.service";
import { monthsSince } from "@/modules/marketing/services/reactivation.service";
import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";
import { isDatabaseAvailable } from "@/lib/test/db-available";
import { convertLeadToPatient } from "@/modules/marketing/services/lead-conversion.service";
import { normalizeSearchName } from "@/lib/crypto/search-hash";

describe("marketing ROI", () => {
  it("calcula CAC determinístico", () => {
    expect(calculateCac(300_000, 3)).toBe(100_000);
    expect(calculateCac(300_000, 0)).toBe(0);
  });

  it("calcula LTV por coorte", () => {
    expect(calculateLtv(150_000, 3)).toBe(50_000);
  });

  it("calcula ROI", () => {
    expect(calculateRoi(150_000, 100_000)).toBe(50);
    expect(calculateRoi(80_000, 100_000)).toBe(-20);
  });

  it("taxa de funil", () => {
    expect(funnelStepRate(10, 4)).toBe(40);
    expect(funnelStepRate(0, 5)).toBe(0);
  });
});

describe("reputação NPS", () => {
  it("promotor (≥9) pode receber convite Google", () => {
    expect(shouldInviteGoogleReview(9)).toBe(true);
    expect(shouldInviteGoogleReview(10)).toBe(true);
  });

  it("detrator (≤6) nunca recebe convite", () => {
    expect(shouldNeverInviteGoogleReview(6)).toBe(true);
    expect(shouldNeverInviteGoogleReview(3)).toBe(true);
    expect(shouldNeverInviteGoogleReview(9)).toBe(false);
  });
});

describe("ads adapter — sem dados de saúde", () => {
  let adapter: MockAdsAdapter;

  beforeEach(() => {
    adapter = new MockAdsAdapter();
    adapter.clearForTests();
  });

  it("aceita evento com hashes e consentimento", async () => {
    await adapter.trackEvent({
      event: "lead",
      eventId: "evt-1",
      consentGranted: true,
      userData: buildAdsUserData({
        email: "test@example.com",
        phone: "11999990000",
        hasMarketingConsent: true,
      }),
      customData: { campaign: "verao" },
    });
    expect(adapter.getEventsForTests()).toHaveLength(1);
    const payload = JSON.stringify(adapter.getEventsForTests()[0]);
    expect(payload).not.toMatch(/test@example.com/);
    expect(payload).not.toMatch(/11999990000/);
    expect(payload).not.toMatch(/diagnosis|prontuario|cid/i);
  });

  it("rejeita payload com termo clínico", async () => {
    await expect(
      adapter.trackEvent({
        event: "lead",
        eventId: "bad",
        consentGranted: true,
        customData: { diagnosis: "J06" } as never,
      }),
    ).rejects.toThrow(/sensível/);
  });
});

describe("consentimento marketing público", () => {
  it("schema exige marketingConsent true", async () => {
    const { publicLeadCaptureSchema } = await import(
      "@/modules/marketing/schemas/marketing.schema"
    );
    const fail = publicLeadCaptureSchema.safeParse({
      orgSlug: "clinica",
      fullName: "Ana",
      phone: "11999990000",
      marketingConsent: false,
      privacyPolicyAccepted: true,
    });
    expect(fail.success).toBe(false);

    const ok = publicLeadCaptureSchema.safeParse({
      orgSlug: "clinica",
      fullName: "Ana",
      phone: "11999990000",
      marketingConsent: true,
      privacyPolicyAccepted: true,
    });
    expect(ok.success).toBe(true);
  });
});

describe("cadência e indicação", () => {
  it("opt-out bloqueia cadência", () => {
    const r = shouldSendLeadFollowUp({ marketingConsentAt: new Date() }, true);
    expect(r.send).toBe(false);
    expect(r.reason).toMatch(/opt-out/i);
  });

  it("sem consentimento bloqueia cadência", () => {
    const r = shouldSendLeadFollowUp({ marketingConsentAt: null }, false);
    expect(r.send).toBe(false);
  });

  it("anti-fraude: limite mensal de indicações", () => {
    expect(exceedsReferralMonthlyLimit(3, 3)).toBe(true);
    expect(exceedsReferralMonthlyLimit(2, 3)).toBe(false);
  });
});

describe("reativação", () => {
  it("calcula meses inativos", () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    expect(monthsSince(sixMonthsAgo)).toBeGreaterThanOrEqual(5);
    expect(monthsSince(null)).toBe(Infinity);
  });
});

describe("marketing integração DB", () => {
  let dbAvailable = false;
  let orgAId = "";
  let orgBId = "";

  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) return;
    const ts = Date.now();
    const orgA = await adminPrisma.organization.create({
      data: {
        name: "Mkt A",
        slug: `mkt-a-${ts}`,
        documentType: "CNPJ",
        documentNumber: "11222333000181",
        type: "CLINICA",
        plan: "ENTERPRISE",
      },
    });
    const orgB = await adminPrisma.organization.create({
      data: {
        name: "Mkt B",
        slug: `mkt-b-${ts}`,
        documentType: "CNPJ",
        documentNumber: "11444777000161",
        type: "CLINICA",
        plan: "ENTERPRISE",
      },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;
    await adminPrisma.subscription.createMany({
      data: [
        { organizationId: orgAId, plan: "ENTERPRISE", status: "ATIVA" },
        { organizationId: orgBId, plan: "ENTERPRISE", status: "ATIVA" },
      ],
    });
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await adminPrisma.lead.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await adminPrisma.patient.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await adminPrisma.subscription.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await adminPrisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  });

  it("converte lead com deduplicação por telefone e persiste UTM no paciente", async () => {
    if (!dbAvailable) return;
    const db = createTenantClient(orgAId);
    const phone = `11988${String(Date.now()).slice(-6)}`;

    const existing = await db.patient.create({
      data: {
        organizationId: orgAId,
        searchName: normalizeSearchName("Paciente Existente"),
        fullName: "Paciente Existente",
        phoneSearch: phone,
      },
    });

    const lead = await db.lead.create({
      data: {
        organizationId: orgAId,
        fullName: "Lead Teste",
        phoneSearch: phone,
        status: "EM_CONTATO",
        utmSource: "google",
        utmCampaign: "test-camp",
        lastStatusAt: new Date(),
      },
    });

    const result = await convertLeadToPatient(db, orgAId, lead.id);
    expect(result.patientId).toBe(existing.id);
    expect(result.deduplicated).toBe(true);

    const patient = await db.patient.findFirstOrThrow({ where: { id: existing.id } });
    expect(patient.utmSource).toBe("google");
    expect(patient.utmCampaign).toBe("test-camp");
    expect(patient.acquiredAt).not.toBeNull();
  });

  it("isola leads por tenant", async () => {
    if (!dbAvailable) return;
    const dbA = createTenantClient(orgAId);
    const dbB = createTenantClient(orgBId);
    const phoneA = `11977${String(Date.now()).slice(-6)}`;
    const phoneB = `11966${String(Date.now()).slice(-6)}`;

    await dbA.lead.create({
      data: {
        organizationId: orgAId,
        fullName: "Lead A",
        phoneSearch: phoneA,
        status: "NOVO",
        lastStatusAt: new Date(),
      },
    });
    await dbB.lead.create({
      data: {
        organizationId: orgBId,
        fullName: "Lead B",
        phoneSearch: phoneB,
        status: "NOVO",
        lastStatusAt: new Date(),
      },
    });

    const leadsA = await dbA.lead.findMany({ where: { organizationId: orgAId } });
    const leadsB = await dbB.lead.findMany({ where: { organizationId: orgBId } });
    expect(leadsA.every((l) => l.organizationId === orgAId)).toBe(true);
    expect(leadsB.every((l) => l.organizationId === orgBId)).toBe(true);
    expect(leadsA.some((l) => l.phoneSearch === phoneB)).toBe(false);
  });
});
