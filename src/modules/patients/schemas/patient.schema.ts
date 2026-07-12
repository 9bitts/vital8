import { z } from "zod";
import { isValidCpf, normalizeCpf } from "@/lib/crypto/search-hash";

export const sexEnum = z.enum([
  "MASCULINO",
  "FEMININO",
  "INTERSEX",
  "NAO_INFORMADO",
]);

export const maritalStatusEnum = z.enum([
  "SOLTEIRO",
  "CASADO",
  "DIVORCIADO",
  "VIUVO",
  "UNIAO_ESTAVEL",
  "OUTRO",
  "NAO_INFORMADO",
]);

export const consentChannelEnum = z.enum([
  "PRESENCIAL",
  "DIGITAL",
  "TELEFONE",
  "IMPORTACAO",
]);

export const patientDocCategoryEnum = z.enum([
  "RG",
  "CPF",
  "COMPROVANTE_RESIDENCIA",
  "CARTEIRINHA_CONVENIO",
  "EXAME",
  "OUTRO",
]);

export const addressSchema = z.object({
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
});

export const phoneSchema = z.object({
  number: z.string().min(8, "Telefone inválido"),
  label: z.string().optional(),
  isWhatsApp: z.boolean().optional(),
});

const cpfSchema = z
  .string()
  .optional()
  .refine((val) => !val || isValidCpf(val), "CPF inválido")
  .transform((val) => (val ? normalizeCpf(val) : undefined));

export const quickPatientSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  phone: z.string().min(8, "Telefone inválido"),
});

export const patientPersonalSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  socialName: z.string().optional(),
  cpf: cpfSchema,
  rg: z.string().optional(),
  birthDate: z.string().optional(),
  sex: z
    .union([sexEnum, z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  genderIdentity: z.string().optional(),
  maritalStatus: z
    .union([maritalStatusEnum, z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  profession: z.string().optional(),
  referralSource: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const patientContactSchema = z.object({
  phones: z.array(phoneSchema).default([]),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  address: addressSchema.optional(),
});

export const patientInsuranceSchema = z.object({
  id: z.string().optional(),
  insurerName: z.string().min(1, "Convênio obrigatório"),
  planName: z.string().optional(),
  cardNumber: z.string().min(1, "Número da carteirinha obrigatório"),
  validUntil: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export const patientGuardianSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().min(2),
  cpf: cpfSchema,
  phone: z.string().optional(),
  relationship: z.string().min(1),
  isPrimary: z.boolean().default(false),
});

export const allergySchema = z.object({
  id: z.string().optional(),
  substance: z.string().min(1),
  severity: z.string().optional(),
  notes: z.string().optional(),
});

export const chronicConditionSchema = z.object({
  id: z.string().optional(),
  condition: z.string().min(1),
  cidCode: z.string().optional(),
  diagnosedAt: z.string().optional(),
  notes: z.string().optional(),
});

export const medicationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  route: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

export const patientConsentSchema = z.object({
  termKey: z.string().min(1),
  termVersion: z.string().min(1),
  purpose: z.string().min(1),
  channel: consentChannelEnum,
});

export const patientSearchSchema = z.object({
  query: z.string().optional(),
  tag: z.string().optional(),
  insurer: z.string().optional(),
  includeInactive: z.boolean().default(false),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const mergePatientsSchema = z.object({
  primaryPatientId: z.string().min(1),
  secondaryPatientId: z.string().min(1),
  fieldChoices: z.object({
    fullName: z.enum(["primary", "secondary"]),
    socialName: z.enum(["primary", "secondary"]),
    cpf: z.enum(["primary", "secondary"]),
    birthDate: z.enum(["primary", "secondary"]),
    phone: z.enum(["primary", "secondary"]),
    email: z.enum(["primary", "secondary"]),
  }),
});

export const csvImportRowSchema = z.object({
  fullName: z.string().min(1),
  cpf: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  birthDate: z.string().optional(),
  insurerName: z.string().optional(),
  cardNumber: z.string().optional(),
  tags: z.string().optional(),
});

export const csvImportSchema = z.object({
  rows: z.array(csvImportRowSchema).min(1).max(500),
  skipDuplicates: z.boolean().default(true),
});

export type PatientPersonalInput = z.infer<typeof patientPersonalSchema>;
export type PatientContactInput = z.infer<typeof patientContactSchema>;
export type QuickPatientInput = z.infer<typeof quickPatientSchema>;
export type PatientSearchInput = z.infer<typeof patientSearchSchema>;
export type MergePatientsInput = z.infer<typeof mergePatientsSchema>;
export type CsvImportInput = z.infer<typeof csvImportSchema>;
