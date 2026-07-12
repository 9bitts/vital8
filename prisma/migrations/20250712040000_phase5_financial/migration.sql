-- Phase 5: Financial module

CREATE TYPE "SaleStatus" AS ENUM ('RASCUNHO', 'CONFIRMADA', 'CANCELADA');
CREATE TYPE "SaleItemType" AS ENUM ('SERVICE', 'PACKAGE', 'PRODUCT');
CREATE TYPE "ReceivableStatus" AS ENUM ('ABERTO', 'PARCIAL', 'PAGO', 'VENCIDO', 'CANCELADO');
CREATE TYPE "ReceivableOrigin" AS ENUM ('SALE', 'AVULSO');
CREATE TYPE "PaymentMethod" AS ENUM ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'LINK');
CREATE TYPE "PayableStatus" AS ENUM ('ABERTO', 'PAGO', 'CANCELADO');
CREATE TYPE "CashRegisterStatus" AS ENUM ('ABERTO', 'FECHADO');
CREATE TYPE "CashRegisterEntryType" AS ENUM ('ABERTURA', 'PAGAMENTO', 'SANGRIA', 'REFORCO', 'ESTORNO');
CREATE TYPE "CommissionRuleType" AS ENUM ('PERCENTUAL', 'FIXO');
CREATE TYPE "CommissionBase" AS ENUM ('FATURADO', 'RECEBIDO');
CREATE TYPE "CommissionStatementStatus" AS ENUM ('ABERTO', 'FECHADO', 'PAGO');
CREATE TYPE "FinancialCategoryType" AS ENUM ('RECEITA', 'DESPESA');
CREATE TYPE "PackagePurchaseStatus" AS ENUM ('ATIVO', 'ESGOTADO', 'CANCELADO');

ALTER TABLE "Appointment" ADD COLUMN "saleId" TEXT;
CREATE UNIQUE INDEX "Appointment_saleId_key" ON "Appointment"("saleId");

CREATE TABLE "PriceTable" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "insurerName" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PriceTable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceTableItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "priceTableId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    CONSTRAINT "PriceTableItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT,
    "status" "SaleStatus" NOT NULL DEFAULT 'RASCUNHO',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "discountAuthorizedByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "nfseNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "itemType" "SaleItemType" NOT NULL DEFAULT 'SERVICE',
    "serviceId" TEXT,
    "packageId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceId" TEXT,
    "sessionCount" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PackagePurchase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "sessionsTotal" INTEGER NOT NULL,
    "sessionsUsed" INTEGER NOT NULL DEFAULT 0,
    "status" "PackagePurchaseStatus" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PackagePurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PackagePurchase_saleId_key" ON "PackagePurchase"("saleId");

CREATE TABLE "PackageSessionConsumption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PackageSessionConsumption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PackageSessionConsumption_appointmentId_key" ON "PackageSessionConsumption"("appointmentId");

CREATE TABLE "Receivable" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "saleId" TEXT,
    "origin" "ReceivableOrigin" NOT NULL DEFAULT 'SALE',
    "description" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "status" "ReceivableStatus" NOT NULL DEFAULT 'ABERTO',
    "installmentNumber" INTEGER NOT NULL DEFAULT 1,
    "installmentCount" INTEGER NOT NULL DEFAULT 1,
    "dueDate" DATE NOT NULL,
    "reminderSentAt" TIMESTAMP(3),
    "optOutReminders" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "receivableId" TEXT,
    "saleId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "netAmountCents" INTEGER NOT NULL,
    "feePercent" INTEGER NOT NULL DEFAULT 0,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "method" "PaymentMethod" NOT NULL,
    "creditCardInstallments" INTEGER NOT NULL DEFAULT 1,
    "expectedCreditDate" DATE,
    "cashRegisterId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialCategoryType" NOT NULL,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payable" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT,
    "categoryId" TEXT,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "competenceDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringDay" INTEGER,
    "status" "PayableStatus" NOT NULL DEFAULT 'ABERTO',
    "paidAt" TIMESTAMP(3),
    "storageKey" TEXT,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashRegister" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CashRegisterStatus" NOT NULL DEFAULT 'ABERTO',
    "openingAmountCents" INTEGER NOT NULL DEFAULT 0,
    "closingExpectedCents" INTEGER,
    "closingCountedCents" INTEGER,
    "closingDifferenceCents" INTEGER,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashRegisterEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cashRegisterId" TEXT NOT NULL,
    "entryType" "CashRegisterEntryType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paymentId" TEXT,
    "reason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashRegisterEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "serviceId" TEXT,
    "ruleType" "CommissionRuleType" NOT NULL,
    "value" INTEGER NOT NULL,
    "base" "CommissionBase" NOT NULL DEFAULT 'FATURADO',
    "isPrivate" BOOLEAN,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionStatement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "CommissionStatementStatus" NOT NULL DEFAULT 'ABERTO',
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommissionStatement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionStatementItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "saleId" TEXT,
    "paymentId" TEXT,
    "description" TEXT NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    CONSTRAINT "CommissionStatementItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "authorizedByUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PriceTable" ADD CONSTRAINT "PriceTable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriceTableItem" ADD CONSTRAINT "PriceTableItem_priceTableId_fkey" FOREIGN KEY ("priceTableId") REFERENCES "PriceTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriceTableItem" ADD CONSTRAINT "PriceTableItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Package" ADD CONSTRAINT "Package_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Package" ADD CONSTRAINT "Package_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PackagePurchase" ADD CONSTRAINT "PackagePurchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackagePurchase" ADD CONSTRAINT "PackagePurchase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackagePurchase" ADD CONSTRAINT "PackagePurchase_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackagePurchase" ADD CONSTRAINT "PackagePurchase_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackageSessionConsumption" ADD CONSTRAINT "PackageSessionConsumption_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "PackagePurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackageSessionConsumption" ADD CONSTRAINT "PackageSessionConsumption_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payable" ADD CONSTRAINT "Payable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashRegisterEntry" ADD CONSTRAINT "CashRegisterEntry_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashRegisterEntry" ADD CONSTRAINT "CashRegisterEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommissionStatement" ADD CONSTRAINT "CommissionStatement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionStatement" ADD CONSTRAINT "CommissionStatement_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionStatementItem" ADD CONSTRAINT "CommissionStatementItem_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CommissionStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "PriceTable_organizationId_idx" ON "PriceTable"("organizationId");
CREATE INDEX "PriceTable_deletedAt_idx" ON "PriceTable"("deletedAt");
CREATE UNIQUE INDEX "PriceTableItem_priceTableId_serviceId_key" ON "PriceTableItem"("priceTableId", "serviceId");
CREATE INDEX "PriceTableItem_organizationId_idx" ON "PriceTableItem"("organizationId");
CREATE INDEX "PriceTableItem_serviceId_idx" ON "PriceTableItem"("serviceId");
CREATE INDEX "Sale_organizationId_idx" ON "Sale"("organizationId");
CREATE INDEX "Sale_patientId_idx" ON "Sale"("patientId");
CREATE INDEX "Sale_status_idx" ON "Sale"("status");
CREATE INDEX "Sale_deletedAt_idx" ON "Sale"("deletedAt");
CREATE INDEX "SaleItem_organizationId_idx" ON "SaleItem"("organizationId");
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX "Package_organizationId_idx" ON "Package"("organizationId");
CREATE INDEX "Package_deletedAt_idx" ON "Package"("deletedAt");
CREATE INDEX "PackagePurchase_organizationId_idx" ON "PackagePurchase"("organizationId");
CREATE INDEX "PackagePurchase_patientId_idx" ON "PackagePurchase"("patientId");
CREATE INDEX "PackageSessionConsumption_organizationId_idx" ON "PackageSessionConsumption"("organizationId");
CREATE INDEX "PackageSessionConsumption_purchaseId_idx" ON "PackageSessionConsumption"("purchaseId");
CREATE INDEX "Receivable_organizationId_idx" ON "Receivable"("organizationId");
CREATE INDEX "Receivable_patientId_idx" ON "Receivable"("patientId");
CREATE INDEX "Receivable_status_idx" ON "Receivable"("status");
CREATE INDEX "Receivable_dueDate_idx" ON "Receivable"("dueDate");
CREATE INDEX "Receivable_deletedAt_idx" ON "Receivable"("deletedAt");
CREATE INDEX "Payment_organizationId_idx" ON "Payment"("organizationId");
CREATE INDEX "Payment_patientId_idx" ON "Payment"("patientId");
CREATE INDEX "Payment_receivableId_idx" ON "Payment"("receivableId");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");
CREATE INDEX "Payment_deletedAt_idx" ON "Payment"("deletedAt");
CREATE INDEX "Supplier_organizationId_idx" ON "Supplier"("organizationId");
CREATE INDEX "Supplier_deletedAt_idx" ON "Supplier"("deletedAt");
CREATE INDEX "FinancialCategory_organizationId_idx" ON "FinancialCategory"("organizationId");
CREATE INDEX "FinancialCategory_parentId_idx" ON "FinancialCategory"("parentId");
CREATE INDEX "BankAccount_organizationId_idx" ON "BankAccount"("organizationId");
CREATE INDEX "Payable_organizationId_idx" ON "Payable"("organizationId");
CREATE INDEX "Payable_dueDate_idx" ON "Payable"("dueDate");
CREATE INDEX "Payable_status_idx" ON "Payable"("status");
CREATE INDEX "Payable_deletedAt_idx" ON "Payable"("deletedAt");
CREATE INDEX "CashRegister_organizationId_idx" ON "CashRegister"("organizationId");
CREATE INDEX "CashRegister_userId_idx" ON "CashRegister"("userId");
CREATE INDEX "CashRegister_status_idx" ON "CashRegister"("status");
CREATE INDEX "CashRegisterEntry_organizationId_idx" ON "CashRegisterEntry"("organizationId");
CREATE INDEX "CashRegisterEntry_cashRegisterId_idx" ON "CashRegisterEntry"("cashRegisterId");
CREATE INDEX "CommissionRule_organizationId_idx" ON "CommissionRule"("organizationId");
CREATE INDEX "CommissionRule_professionalId_idx" ON "CommissionRule"("professionalId");
CREATE INDEX "CommissionStatement_organizationId_idx" ON "CommissionStatement"("organizationId");
CREATE INDEX "CommissionStatement_professionalId_idx" ON "CommissionStatement"("professionalId");
CREATE INDEX "CommissionStatement_status_idx" ON "CommissionStatement"("status");
CREATE INDEX "CommissionStatementItem_organizationId_idx" ON "CommissionStatementItem"("organizationId");
CREATE INDEX "CommissionStatementItem_statementId_idx" ON "CommissionStatementItem"("statementId");
CREATE INDEX "Refund_organizationId_idx" ON "Refund"("organizationId");
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");
