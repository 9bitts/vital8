-- Unique active organization document (CNPJ/CPF) per tenant registry
CREATE UNIQUE INDEX "Organization_documentNumber_active_key"
ON "Organization" ("documentNumber")
WHERE "deletedAt" IS NULL AND "isActive" = true;
