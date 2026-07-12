import { adminPrisma } from "@/lib/db/admin-client";

/** Models com organizationId — isolamento row-level obrigatório. */
const TENANT_SCOPED_MODELS = new Set([
  "Membership",
  "Invitation",
  "AuditLog",
  "Patient",
  "PatientGuardian",
  "PatientInsurancePlan",
  "PatientConsent",
  "PatientDocument",
  "Allergy",
  "ChronicCondition",
  "PatientMedication",
  "Professional",
  "Service",
  "Room",
  "ScheduleTemplate",
  "ScheduleException",
  "Holiday",
  "Appointment",
  "WaitingListEntry",
  "Encounter",
  "EncounterSection",
  "EncounterAmendment",
  "FormTemplate",
  "FormTemplateVersion",
  "FormResponse",
  "Prescription",
  "PrescriptionItem",
  "MedicalCertificate",
  "DocumentTemplate",
  "ExamRequest",
  "ExamRequestItem",
  "ExamResult",
  "ExamResultValue",
  "Odontogram",
  "OdontogramEntry",
  "BodyChartEntry",
  "RecordAccessLog",
  "PriceTable",
  "PriceTableItem",
  "Sale",
  "SaleItem",
  "Package",
  "PackagePurchase",
  "PackageSessionConsumption",
  "Receivable",
  "Payment",
  "Payable",
  "Supplier",
  "FinancialCategory",
  "BankAccount",
  "CashRegister",
  "CashRegisterEntry",
  "CommissionRule",
  "CommissionStatement",
  "CommissionStatementItem",
  "Refund",
  "HealthInsurer",
  "InsurerContract",
  "PriorAuthorization",
  "TissGuide",
  "TissBatch",
  "TissSequence",
  "GlosaItem",
  "InsurerPayment",
  "Product",
  "StockLocation",
  "StockBatch",
  "StockBalance",
  "StockMovement",
  "PurchaseOrder",
  "PurchaseOrderItem",
  "ServiceConsumptionKit",
  "ServiceConsumptionKitItem",
  "Inventory",
  "InventoryCount",
  "MessageTemplate",
  "AutomationRule",
  "CommunicationLog",
  "PatientOptOut",
  "PatientPortalOtp",
  "PatientPortalSession",
  "OnlineBookingConfig",
  "TeleconsultConsent",
  "TeleconsultRoom",
  "NpsSurvey",
  "NpsResponse",
  "ReleasedDocument",
  "Campaign",
  "PatientDataCorrectionRequest",
  "DailyOrgMetrics",
  "Branch",
  "PermissionProfile",
  "Subscription",
  "OnboardingProgress",
  "OrganizationExport",
  "DailyProfessionalMetrics",
  "PerformanceGoal",
  "AiFaq",
  "AiConversation",
  "AiConversationMessage",
  "RndsCredential",
  "RndsSubmission",
  "InteroperabilitySettings",
  "LabResultReconciliation",
  "MobileSyncLog",
  "MobileIdempotencyRecord",
  "LeadSource",
  "MarketingCampaign",
  "Lead",
  "LeadInteraction",
  "LeadFollowUpLog",
  "LandingPage",
  "TrackedLink",
  "ReferralProgram",
  "Referral",
  "Testimonial",
  "LeadOptOut",
]);

const MODELS_WITH_SOFT_DELETE = new Set([
  "Membership",
  "Patient",
  "PatientGuardian",
  "PatientInsurancePlan",
  "PatientConsent",
  "PatientDocument",
  "Allergy",
  "ChronicCondition",
  "PatientMedication",
  "Professional",
  "Service",
  "Room",
  "ScheduleTemplate",
  "ScheduleException",
  "Holiday",
  "Appointment",
  "WaitingListEntry",
  "Encounter",
  "FormTemplate",
  "Prescription",
  "MedicalCertificate",
  "DocumentTemplate",
  "ExamRequest",
  "ExamResult",
  "PriceTable",
  "Sale",
  "Package",
  "Receivable",
  "Payment",
  "Payable",
  "Supplier",
  "HealthInsurer",
  "InsurerContract",
  "PriorAuthorization",
  "TissGuide",
  "TissBatch",
  "Product",
  "StockLocation",
  "PurchaseOrder",
]);

type QueryArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
};

function isTenantScoped(model: string | undefined): model is string {
  return model !== undefined && TENANT_SCOPED_MODELS.has(model);
}

function mergeWhere(
  existing: Record<string, unknown> | undefined,
  organizationId: string,
  model: string,
): Record<string, unknown> {
  const where: Record<string, unknown> = { ...existing, organizationId };

  if (MODELS_WITH_SOFT_DELETE.has(model)) {
    where.deletedAt = existing?.deletedAt ?? null;
  }

  return where;
}

function injectOrganizationId(
  args: QueryArgs,
  organizationId: string,
  model: string,
  operation: string,
): QueryArgs {
  const next: QueryArgs = { ...args };

  if (operation === "create" || operation === "createMany") {
    if (next.data && !Array.isArray(next.data)) {
      next.data = { ...next.data, organizationId };
    }
    return next;
  }

  if (operation === "upsert") {
    next.where = mergeWhere(next.where, organizationId, model);
    if (next.create) {
      next.create = { ...next.create, organizationId };
    }
    return next;
  }

  if (
    operation === "findUnique" ||
    operation === "findUniqueOrThrow" ||
    operation === "findFirst" ||
    operation === "findFirstOrThrow" ||
    operation === "findMany" ||
    operation === "count" ||
    operation === "aggregate" ||
    operation === "groupBy" ||
    operation === "update" ||
    operation === "updateMany" ||
    operation === "delete" ||
    operation === "deleteMany"
  ) {
    next.where = mergeWhere(next.where, organizationId, model);
  }

  return next;
}

export function createTenantClient(organizationId: string) {
  if (!organizationId) {
    throw new Error("organizationId é obrigatório para o tenant client");
  }

  return adminPrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!isTenantScoped(model)) {
            return query(args);
          }

          const scopedArgs = injectOrganizationId(
            args as QueryArgs,
            organizationId,
            model,
            operation,
          );

          return query(scopedArgs);
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof createTenantClient>;

/** Tipo utilitário para extrair delegate de um model do tenant client. */
export type TenantModel<T extends keyof TenantClient> = TenantClient[T];
