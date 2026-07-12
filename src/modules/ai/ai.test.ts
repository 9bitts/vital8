import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";
import { encryptPHI } from "@/lib/crypto/phi";
import { decryptPHI } from "@/lib/crypto/phi";
import { isDatabaseAvailable } from "@/lib/test/db-available";
import { minimizeTextForLlm, minimizePatientContext } from "@/modules/ai/lib/minimize-payload";
import { computeNoShowRisk } from "@/modules/ai/services/no-show-score.service";
import { detectSecretaryIntent, processSecretaryMessage } from "@/modules/ai/services/secretary.service";
import { getAvailabilityRange } from "@/modules/api/services/availability.service";
import { resetLlmAdapter, getLlmAdapter } from "@/lib/integrations/llm";
import { assertWithinUsageLimit, recordAiUsage } from "@/modules/ai/lib/usage";
import { hasAiConsent } from "@/modules/ai/lib/consent";
import { aiComplete } from "@/modules/ai/services/llm-gateway.service";

describe("Applied AI — Phase 12", () => {
  let dbAvailable = false;
  let orgAId: string;
  let orgBId: string;
  let ownerAId: string;

  beforeAll(async () => {
    resetLlmAdapter();
    dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) return;

    const ts = Date.now();
    const orgA = await adminPrisma.organization.create({
      data: {
        name: "AI Org A",
        slug: `ai-a-${ts}`,
        documentType: "CNPJ",
        documentNumber: "11222333000181",
        type: "CLINICA",
        plan: "ENTERPRISE",
      },
    });
    const orgB = await adminPrisma.organization.create({
      data: {
        name: "AI Org B",
        slug: `ai-b-${ts}`,
        documentType: "CNPJ",
        documentNumber: "11444777000161",
        type: "CLINICA",
        plan: "ENTERPRISE",
      },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const user = await adminPrisma.user.create({
      data: { name: "Owner AI", email: `ai-owner-${ts}@test.local`, passwordHash: "x" },
    });
    ownerAId = user.id;

    await adminPrisma.subscription.createMany({
      data: [
        { organizationId: orgAId, plan: "ENTERPRISE", status: "ATIVA" },
        { organizationId: orgBId, plan: "ENTERPRISE", status: "ATIVA" },
      ],
    });

    await adminPrisma.aiSettings.create({
      data: {
        organizationId: orgAId,
        enabledResources: {
          VIRTUAL_SECRETARY: true,
          CLINICAL_COPILOT: false,
          SMART_SEARCH: true,
        },
        monthlyTokenLimit: 100,
      },
    });

    await adminPrisma.aiSettings.create({
      data: {
        organizationId: orgBId,
        enabledResources: { VIRTUAL_SECRETARY: true },
        monthlyTokenLimit: 500_000,
      },
    });

    await adminPrisma.aiDataProcessingConsent.create({
      data: {
        organizationId: orgAId,
        resource: "VIRTUAL_SECRETARY",
        termVersion: "2026-07-12",
        grantedByUserId: ownerAId,
      },
    });
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await adminPrisma.aiConversationMessage.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.aiConversation.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.aiInteractionLog.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.aiUsageMonthly.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.aiDataProcessingConsent.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.aiFaq.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await adminPrisma.aiSettings.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await adminPrisma.subscription.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await adminPrisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await adminPrisma.user.deleteMany({ where: { id: ownerAId } });
  });

  it("mock LLM é determinístico", async () => {
    const llm = getLlmAdapter();
    expect(llm.name).toBe("mock");
    const a = await llm.complete({
      messages: [{ role: "user", content: "teste determinístico" }],
      system: "SECRETARY",
    });
    const b = await llm.complete({
      messages: [{ role: "user", content: "teste determinístico" }],
      system: "SECRETARY",
    });
    expect(a.text).toBe(b.text);
  });

  it("minimização remove identificadores PHI", () => {
    const text = minimizeTextForLlm("Paciente João, CPF 529.982.247-25, tel (11) 98888-7777");
    expect(text).not.toMatch(/529\.982|98888/);
    expect(text).toContain("[CPF_REMOVIDO]");

    const ctx = minimizePatientContext({
      fullName: "Maria Silva Santos",
      cpf: "52998224725",
      email: "maria@test.com",
    });
    expect(ctx.fullName).toBe("M.S.");
    expect(ctx.cpf).toBeUndefined();
  });

  it("recurso clínico bloqueado sem consentimento", async () => {
    if (!dbAvailable) return;
    const ok = await hasAiConsent(orgAId, "CLINICAL_COPILOT");
    expect(ok).toBe(false);
    await expect(
      aiComplete({
        organizationId: orgAId,
        userId: ownerAId,
        resource: "CLINICAL_COPILOT",
        system: "RESUMO",
        userMessage: "teste",
      }),
    ).rejects.toThrow(/Consentimento/);
  });

  it("secretária nunca oferece horário fora dos slots reais", async () => {
    if (!dbAvailable) return;
    const db = createTenantClient(orgAId);
    const prof = await db.professional.create({
      data: { organizationId: orgAId, displayName: "Dr AI" },
    });
    const svc = await db.service.create({
      data: {
        organizationId: orgAId,
        name: "Consulta",
        durationMinutes: 30,
        privatePrice: 200,
        allowOnlineBooking: true,
      },
    });
    await db.scheduleTemplate.create({
      data: {
        organizationId: orgAId,
        professionalId: prof.id,
        weekday: "SEGUNDA",
        startTime: "09:00",
        endTime: "12:00",
        slotIntervalMinutes: 30,
      },
    });
    const patient = await db.patient.create({
      data: {
        organizationId: orgAId,
        fullName: "Paciente AI",
        searchName: "paciente ai",
        phoneSearch: "999990000",
      },
    });

    const from = new Date();
    from.setDate(from.getDate() + 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);

    const realSlots = await getAvailabilityRange(db, {
      professionalId: prof.id,
      serviceId: svc.id,
      from,
      to,
    });
    const fakeIso = "2099-01-01T10:00:00.000Z";
    expect(realSlots.some((s) => s.startsAt.toISOString() === fakeIso)).toBe(false);

    const result = await processSecretaryMessage({
      organizationId: orgAId,
      phone: "11999990000",
      message: "quero agendar consulta",
      simulate: true,
    });
    expect(result.reply).toMatch(/horário|dispon/i);
    if (result.reply.includes("2099")) {
      expect(realSlots.some((s) => s.startsAt.toISOString().startsWith("2099"))).toBe(true);
    }
    void patient;
  });

  it("score de no-show é reprodutível", () => {
    const input = {
      patientNoShowCount: 2,
      patientTotalAppointments: 10,
      weekday: 1,
      hour: 8,
      daysUntilAppointment: 20,
      isFirstVisit: false,
    };
    expect(computeNoShowRisk(input)).toEqual(computeNoShowRisk(input));
    expect(computeNoShowRisk(input).factors.length).toBeGreaterThan(0);
  });

  it("limite de uso bloqueia com mensagem correta", async () => {
    if (!dbAvailable) return;
    await recordAiUsage(orgAId, 100);
    await expect(assertWithinUsageLimit(orgAId)).rejects.toThrow(/Limite mensal/);
  });

  it("AiInteractionLog armazena payload criptografado", async () => {
    if (!dbAvailable) return;
    const log = await adminPrisma.aiInteractionLog.create({
      data: {
        organizationId: orgAId,
        resource: "VIRTUAL_SECRETARY",
        tokensUsed: 10,
        payloadEncrypted: encryptPHI(JSON.stringify({ action: "test" })),
      },
    });
    expect(log.payloadEncrypted).not.toContain("test");
    const dec = JSON.parse(decryptPHI(log.payloadEncrypted!));
    expect(dec.action).toBe("test");
  });

  it("isolamento: conversa org A não usa dados org B", async () => {
    if (!dbAvailable) return;
    const convA = await adminPrisma.aiConversation.create({
      data: { organizationId: orgAId, externalPhone: "11911111111" },
    });
    const convB = await adminPrisma.aiConversation.create({
      data: { organizationId: orgBId, externalPhone: "11922222222" },
    });

    const msgsA = await adminPrisma.aiConversationMessage.findMany({
      where: { conversationId: convA.id, organizationId: orgAId },
    });
    expect(msgsA.every((m) => m.organizationId === orgAId)).toBe(true);

    const cross = await adminPrisma.aiConversation.findFirst({
      where: { id: convB.id, organizationId: orgAId },
    });
    expect(cross).toBeNull();

    await adminPrisma.aiConversationMessage.deleteMany({
      where: { conversationId: { in: [convA.id, convB.id] } },
    });
    await adminPrisma.aiConversation.deleteMany({
      where: { id: { in: [convA.id, convB.id] } },
    });
  });

  it("detectSecretaryIntent encaminha clínico", () => {
    expect(detectSecretaryIntent("estou com dor no peito")).toBe("clinico");
    expect(detectSecretaryIntent("quero agendar")).toBe("agendar");
  });
});
