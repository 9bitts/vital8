import type { FiscalDocumentStatus, Prisma } from "@/generated/prisma/client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { decryptPHI, encryptPHI } from "@/lib/crypto/phi";
import { getNfseAdapter } from "@/lib/integrations/nfse";
import { getStorageAdapter } from "@/lib/integrations/storage";
import {
  decryptCertificate,
  getOrCreateFiscalSettings,
  resolveFiscalDocumentType,
} from "./fiscal-settings.service";
import { buildReceitaSaudeReceipt } from "./receita-saude.service";

const MAX_RETRIES = 5;
const RETRY_MINUTES = [1, 5, 15, 60, 240];

export async function enqueueFiscalEmission(
  db: TenantClient,
  organizationId: string,
  paymentId: string,
  options?: { force?: boolean },
) {
  const existing = await db.fiscalDocument.findFirst({
    where: { paymentId, status: { in: ["PENDING", "PROCESSING", "ISSUED"] } },
  });
  if (existing && !options?.force) return existing;

  const payment = await db.payment.findFirstOrThrow({
    where: { id: paymentId },
    include: {
      sale: { include: { items: true, professional: true } },
      patient: true,
    },
  });

  const [settings, org] = await Promise.all([
    getOrCreateFiscalSettings(db, organizationId),
    db.organization.findFirstOrThrow({ where: { id: organizationId } }),
  ]);

  if (!settings.autoEmitOnPayment && !options?.force) return null;

  const documentType = resolveFiscalDocumentType(
    settings.emitProfile,
    org.documentType,
    org.type,
  );

  const serviceDescription =
    payment.sale?.items.map((i) => i.description).join(", ") ??
    payment.notes ??
    "Serviços de saúde";

  const patientCpf = payment.patient.cpfEncrypted
    ? decryptPHI(payment.patient.cpfEncrypted)
    : null;

  return db.fiscalDocument.create({
    data: {
      organizationId,
      documentType,
      status: "PENDING",
      amountCents: payment.amountCents,
      patientId: payment.patientId,
      paymentId: payment.id,
      saleId: payment.saleId,
      professionalId: payment.sale?.professionalId ?? null,
      patientCpfEncrypted: patientCpf ? encryptPHI(patientCpf) : null,
      serviceDescription,
      nextRetryAt: new Date(),
    },
  });
}


export async function emitFiscalDocument(
  db: TenantClient,
  organizationId: string,
  documentId: string,
) {
  const doc = await db.fiscalDocument.findFirstOrThrow({
    where: { id: documentId, organizationId },
  });

  if (doc.status === "ISSUED" || doc.status === "CANCELLED") return doc;

  await db.fiscalDocument.update({
    where: { id: documentId },
    data: { status: "PROCESSING" },
  });

  try {
    const [settings, org, payment, patient] = await Promise.all([
      getOrCreateFiscalSettings(db, organizationId),
      db.organization.findFirstOrThrow({ where: { id: organizationId } }),
      doc.paymentId
        ? db.payment.findFirst({
            where: { id: doc.paymentId },
            include: { sale: { include: { professional: true, items: true } } },
          })
        : null,
      db.patient.findFirstOrThrow({ where: { id: doc.patientId } }),
    ]);

    const patientName = patient.socialName ?? patient.fullName;
    const patientCpf = doc.patientCpfEncrypted
      ? decryptPHI(doc.patientCpfEncrypted)
      : patient.cpfEncrypted
        ? decryptPHI(patient.cpfEncrypted)
        : undefined;

    const serviceDescription = doc.serviceDescription ?? "Serviços de saúde";
    const storage = getStorageAdapter();
    let number: string;
    let accessKey: string | null = null;
    let dpsNumber: string | null = null;
    let pdfBase64: string;
    let responsePayload: Record<string, unknown>;

    if (doc.documentType === "RECIBO_RECEITA_SAUDE") {
      const prof = payment?.sale?.professional;
      const receipt = buildReceitaSaudeReceipt({
        professionalName: prof?.displayName ?? org.name,
        professionalDocument: org.documentNumber,
        councilType: prof?.councilType ?? null,
        councilNumber: prof?.councilNumber ?? null,
        councilState: prof?.councilState ?? null,
        patientName,
        patientCpf: patientCpf ?? "00000000000",
        serviceDescription,
        amountCents: doc.amountCents,
        paymentDate: payment?.createdAt ?? new Date(),
        organizationName: org.name,
      });
      number = receipt.number;
      pdfBase64 = receipt.pdfBase64;
      responsePayload = receipt.payload;
    } else {
      const certs = decryptCertificate(settings);
      const adapter = getNfseAdapter(settings.nfseProvider);
      const result = await adapter.issue({
        organizationId,
        organizationDocument: org.documentNumber,
        organizationName: org.name,
        patientName,
        patientDocument: patientCpf,
        patientDocumentType: "CPF",
        serviceDescription,
        amountCents: doc.amountCents,
        nacionalServiceCode: settings.nacionalServiceCode ?? undefined,
        cnae: settings.cnae ?? undefined,
        issRateBasisPoints: settings.issRateBasisPoints,
        municipioIbgeCode: settings.municipioIbgeCode ?? undefined,
        inscricaoMunicipal: settings.inscricaoMunicipal ?? undefined,
        certificatePfxBase64: certs.certificatePfxBase64 ?? undefined,
        certificatePassword: certs.certificatePassword ?? undefined,
        cbsIbsEnabled: settings.cbsIbsEnabled,
        cbsRateBasisPoints: settings.cbsRateBasisPoints ?? undefined,
        ibsRateBasisPoints: settings.ibsRateBasisPoints ?? undefined,
        paymentId: doc.paymentId ?? undefined,
        saleId: doc.saleId ?? undefined,
      });
      number = result.number;
      accessKey = result.accessKey;
      dpsNumber = result.dpsNumber;
      pdfBase64 = result.pdfBase64;
      responsePayload = result.xmlOrJson;
    }

    const stored = await storage.upload(
      organizationId,
      doc.patientId,
      `fiscal-${documentId}.pdf`,
      "application/pdf",
      Buffer.from(pdfBase64, "base64"),
    );

    const updated = await db.fiscalDocument.update({
      where: { id: documentId },
      data: {
        status: "ISSUED" as FiscalDocumentStatus,
        number,
        accessKey,
        dpsNumber,
        responsePayload: responsePayload as Prisma.InputJsonValue,
        pdfStorageKey: stored.storageKey,
        issuedAt: new Date(),
        errorMessage: null,
        nextRetryAt: null,
      },
    });

    if (doc.saleId) {
      await db.sale.update({
        where: { id: doc.saleId },
        data: { nfseNumber: number },
      });
    }

    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro na emissão fiscal";
    const retryCount = doc.retryCount + 1;
    const delayMin = RETRY_MINUTES[Math.min(retryCount - 1, RETRY_MINUTES.length - 1)];
    const nextRetryAt = new Date(Date.now() + delayMin * 60 * 1000);

    return db.fiscalDocument.update({
      where: { id: documentId },
      data: {
        status: retryCount >= MAX_RETRIES ? "FAILED" : "PENDING",
        errorMessage: message,
        retryCount,
        nextRetryAt: retryCount >= MAX_RETRIES ? null : nextRetryAt,
      },
    });
  }
}

export async function listFiscalDocuments(
  db: TenantClient,
  organizationId: string,
  limit = 50,
) {
  return db.fiscalDocument.findMany({
    where: { organizationId },
    include: {
      patient: { select: { fullName: true, socialName: true } },
      payment: { select: { amountCents: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listPatientFiscalDocuments(
  db: TenantClient,
  organizationId: string,
  patientId: string,
) {
  return db.fiscalDocument.findMany({
    where: {
      organizationId,
      patientId,
      status: "ISSUED",
      pdfStorageKey: { not: null },
    },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      documentType: true,
      number: true,
      amountCents: true,
      issuedAt: true,
      serviceDescription: true,
    },
  });
}

export async function generateCarnêLeaoReport(
  db: TenantClient,
  organizationId: string,
  year: number,
  month: number,
  professionalId?: string | null,
) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);

  const docs = await db.fiscalDocument.findMany({
    where: {
      organizationId,
      documentType: "RECIBO_RECEITA_SAUDE",
      status: "ISSUED",
      issuedAt: { gte: from, lte: to },
      ...(professionalId ? { professionalId } : {}),
    },
    include: {
      patient: { select: { fullName: true, socialName: true } },
      professional: { select: { displayName: true } },
    },
    orderBy: { issuedAt: "asc" },
  });

  const { buildCarnêLeaoCsv } = await import("./receita-saude.service");

  const rows = docs.map((d) => ({
    date: (d.issuedAt ?? d.createdAt).toISOString().slice(0, 10),
    patientName: d.patient.socialName ?? d.patient.fullName,
    patientCpf: d.patientCpfEncrypted ? decryptPHI(d.patientCpfEncrypted) : "",
    serviceDescription: d.serviceDescription ?? "Serviços de saúde",
    amountCents: d.amountCents,
    professionalName: d.professional?.displayName ?? "",
    documentNumber: d.number ?? "",
  }));

  return {
    rows,
    csv: buildCarnêLeaoCsv(rows),
    totalCents: rows.reduce((s, r) => s + r.amountCents, 0),
  };
}
