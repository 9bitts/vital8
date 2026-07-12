import { API_SCOPES, WEBHOOK_EVENTS } from "./scopes";

export function buildOpenApiSpec() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    openapi: "3.1.0",
    info: {
      title: "Vital8 Public API",
      version: "1.0.0",
      description:
        "API REST versionada do Vital8 para integrações externas. Autenticação: Bearer {keyPrefix}.{secret}",
    },
    servers: [{ url: `${baseUrl}/api/v1` }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Token no formato vk_live_xxx.secret ou vk_test_xxx.secret",
        },
      },
      schemas: {
        ApiSuccess: {
          type: "object",
          properties: {
            data: {},
            meta: { type: "object" },
          },
        },
        ApiError: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: { type: "array", items: {} },
              },
            },
          },
        },
        Patient: {
          type: "object",
          properties: {
            id: { type: "string" },
            fullName: { type: "string" },
            birthDate: { type: "string", format: "date", nullable: true },
            email: { type: "string", nullable: true },
            isActive: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Appointment: {
          type: "object",
          properties: {
            id: { type: "string" },
            patientId: { type: "string" },
            professionalId: { type: "string" },
            serviceId: { type: "string" },
            startsAt: { type: "string", format: "date-time" },
            endsAt: { type: "string", format: "date-time" },
            status: { type: "string" },
            origin: { type: "string" },
          },
        },
      },
    },
    paths: {
      "/ping": {
        get: {
          summary: "Valida credenciais e retorna escopos",
          responses: { "200": { description: "OK" } },
        },
      },
      "/organization": {
        get: { summary: "Dados básicos da organização e filiais", responses: { "200": { description: "OK" } } },
      },
      "/patients": {
        get: {
          summary: "Lista pacientes",
          parameters: [
            { name: "cursor", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
            { name: "updatedAfter", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "cpf", in: "query", schema: { type: "string" } },
            { name: "q", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          summary: "Cria paciente",
          parameters: [
            { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } },
          ],
          responses: { "201": { description: "Criado" } },
        },
      },
      "/availability": {
        get: {
          summary: "Slots livres",
          parameters: [
            { name: "professionalId", in: "query", required: true, schema: { type: "string" } },
            { name: "serviceId", in: "query", required: true, schema: { type: "string" } },
            { name: "from", in: "query", required: true, schema: { type: "string", format: "date-time" } },
            { name: "to", in: "query", required: true, schema: { type: "string", format: "date-time" } },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/appointments": {
        get: { summary: "Lista agendamentos", responses: { "200": { description: "OK" } } },
        post: {
          summary: "Cria agendamento",
          parameters: [
            { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } },
          ],
          responses: { "201": { description: "Criado" }, "409": { description: "Conflito de estado/slot" } },
        },
      },
    },
    "x-scopes": API_SCOPES,
    "x-webhook-events": WEBHOOK_EVENTS,
  };
}
