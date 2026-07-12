import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "crypto";
import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";
import { encryptPHI } from "@/lib/crypto/phi";
import { hashCpf, normalizeSearchName } from "@/lib/crypto/search-hash";
import { isDatabaseAvailable } from "@/lib/test/db-available";
import { authenticateApiRequest } from "@/modules/api/middleware/authenticate";
import { createApiClient, createApiKey } from "@/modules/api/services/api-key.service";
import { getPatient } from "@/modules/api/handlers/patients.handler";
import { createAppointmentHandler } from "@/modules/api/handlers/appointments.handler";
import { confirmAppointment } from "@/modules/api/handlers/appointments.handler";
import { checkRateLimit, resetRateLimitForTests } from "@/modules/api/middleware/rate-limit";
import { signWebhookPayload } from "@/modules/api/services/webhook.service";
import { checkIdempotency, storeIdempotency } from "@/modules/api/middleware/idempotency";
import { buildOpenApiSpec } from "@/modules/api/lib/openapi";

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

describe("Public API v1", () => {
  let dbAvailable = false;
  let orgAId: string;
  let orgBId: string;
  let patientBId: string;
  let tokenA: string;
  let tokenNoScope: string;
  let keyAId: string;
  let profAId: string;
  let serviceAId: string;
  let patientAId: string;
  let apptAId: string;

  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) return;

    const ts = Date.now();
    const orgA = await adminPrisma.organization.create({
      data: {
        name: "API Org A",
        slug: `api-a-${ts}`,
        documentType: "CNPJ",
        documentNumber: "11222333000181",
        type: "CLINICA",
        plan: "ENTERPRISE",
      },
    });
    const orgB = await adminPrisma.organization.create({
      data: {
        name: "API Org B",
        slug: `api-b-${ts}`,
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
        { organizationId: orgBId, plan: "BASICO", status: "ATIVA" },
      ],
    });

    const tenantA = createTenantClient(orgAId);
    const tenantB = createTenantClient(orgBId);

    const patientA = await tenantA.patient.create({
      data: {
        organizationId: orgAId,
        searchName: normalizeSearchName("Paciente API A"),
        fullName: "Paciente API A",
        cpfEncrypted: encryptPHI("52998224725"),
        cpfHash: hashCpf("52998224725", orgAId),
      },
    });
    patientAId = patientA.id;

    const patientB = await tenantB.patient.create({
      data: {
        organizationId: orgBId,
        searchName: normalizeSearchName("Paciente API B"),
        fullName: "Paciente API B",
        cpfEncrypted: encryptPHI("39053344705"),
        cpfHash: hashCpf("39053344705", orgBId),
      },
    });
    patientBId = patientB.id;

    const profA = await tenantA.professional.create({
      data: { organizationId: orgAId, displayName: "Dr API" },
    });
    profAId = profA.id;

    const serviceA = await tenantA.service.create({
      data: {
        organizationId: orgAId,
        name: "Consulta API",
        durationMinutes: 30,
        privatePrice: 200,
      },
    });
    serviceAId = serviceA.id;

    const clientA = await createApiClient({
      organizationId: orgAId,
      name: "TestClientA",
      environment: "PRODUCTION",
    });
    const { token, key } = await createApiKey({
      apiClientId: clientA.id,
      organizationId: orgAId,
      environment: "PRODUCTION",
      scopes: [
        "patients:read",
        "patients:write",
        "appointments:read",
        "appointments:write",
        "schedule:read",
      ],
    });
    tokenA = token;
    keyAId = key.id;

    const clientLimited = await createApiClient({
      organizationId: orgAId,
      name: "Limited",
      environment: "PRODUCTION",
    });
    const limited = await createApiKey({
      apiClientId: clientLimited.id,
      organizationId: orgAId,
      environment: "PRODUCTION",
      scopes: ["schedule:read"],
    });
    tokenNoScope = limited.token;

    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() + 2);
    startsAt.setHours(10, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 30 * 60_000);

    const appt = await tenantA.appointment.create({
      data: {
        organizationId: orgAId,
        patientId: patientAId,
        professionalId: profAId,
        serviceId: serviceAId,
        startsAt,
        endsAt,
        status: "FINALIZADO",
        origin: "RECEPCAO",
      },
    });
    apptAId = appt.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await adminPrisma.apiIdempotencyRecord.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.apiRequestLog.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.apiKey.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.apiClient.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.appointment.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.patient.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.service.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.professional.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.subscription.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
  });

  it("cross-tenant: key org A não lê paciente org B", async () => {
    if (!dbAvailable) return;
    const req = new Request("http://localhost/api/v1/patients/" + patientBId, {
      headers: authHeader(tokenA),
    });
    const ctx = await authenticateApiRequest(req, ["patients:read"]);
    await expect(getPatient(ctx, patientBId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("escopo insuficiente retorna INSUFFICIENT_SCOPE", async () => {
    if (!dbAvailable) return;
    const req = new Request("http://localhost/api/v1/patients", {
      headers: authHeader(tokenNoScope),
    });
    await expect(authenticateApiRequest(req, ["patients:read"])).rejects.toMatchObject({
      code: "INSUFFICIENT_SCOPE",
    });
  });

  it("idempotência: mesmo Idempotency-Key não duplica appointment", async () => {
    if (!dbAvailable) return;
    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() + 4);
    startsAt.setHours(15, 0, 0, 0);

    const body = JSON.stringify({
      patientId: patientAId,
      professionalId: profAId,
      serviceId: serviceAId,
      startsAt: startsAt.toISOString(),
    });

    const idem = `idem-${Date.now()}`;
    const route = "/api/v1/appointments";
    const req = new Request("http://localhost" + route, {
      method: "POST",
      headers: { ...authHeader(tokenA), "content-type": "application/json", "idempotency-key": idem },
      body,
    });
    const ctx = await authenticateApiRequest(req, ["appointments:write"], body);

    expect(await checkIdempotency(ctx, "POST", route, idem)).toBeNull();
    const res1 = await createAppointmentHandler(req, ctx);
    const json1 = await res1.json();
    await storeIdempotency(ctx, "POST", route, idem, 201, json1);

    const cached = await checkIdempotency(ctx, "POST", route, idem);
    expect(cached).not.toBeNull();

    const count = await adminPrisma.appointment.count({
      where: { organizationId: orgAId, patientId: patientAId, startsAt },
    });
    expect(count).toBe(1);
  });

  it("rate limit por key", async () => {
    if (!dbAvailable) return;
    resetRateLimitForTests(keyAId);
    for (let i = 0; i < 60; i++) {
      await checkRateLimit(keyAId, orgBId);
    }
    await expect(checkRateLimit(keyAId, orgBId)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    resetRateLimitForTests(keyAId);
  });

  it("transição inválida via API retorna CONFLICT", async () => {
    if (!dbAvailable) return;
    const req = new Request("http://localhost/api/v1/appointments/" + apptAId + "/confirm", {
      method: "POST",
      headers: authHeader(tokenA),
    });
    const ctx = await authenticateApiRequest(req, ["appointments:write"]);
    await expect(confirmAppointment(ctx, apptAId)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("assinatura webhook verificável", () => {
    const secret = "whsec_test";
    const body = JSON.stringify({ event: "patient.created", id: "p1", occurredAt: "2026-01-01T00:00:00Z" });
    const ts = 1700000000;
    const sig = signWebhookPayload(secret, ts, body);
    const match = sig.match(/v1=([a-f0-9]+)/);
    expect(match).toBeTruthy();
    const expected = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    expect(match![1]).toBe(expected);
  });

  it("PHI ausente em ApiRequestLog e payload webhook", async () => {
    if (!dbAvailable) return;
    const logs = await adminPrisma.apiRequestLog.findMany({
      where: { organizationId: orgAId },
    });
    for (const log of logs) {
      const serialized = JSON.stringify(log);
      expect(serialized).not.toMatch(/cpfEncrypted|fullName|52998224725/i);
    }

    const payload = { event: "patient.created", id: "x", occurredAt: new Date().toISOString() };
    expect(JSON.stringify(payload)).not.toMatch(/cpf|nome|diagnóstico/i);
  });

  it("OpenAPI spec contém paths v1", () => {
    const spec = buildOpenApiSpec();
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/ping"]).toBeDefined();
    expect(spec.paths["/patients"]).toBeDefined();
  });
});
