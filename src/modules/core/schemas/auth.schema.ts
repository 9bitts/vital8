import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
});

export const signupUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiúscula")
    .regex(/[0-9]/, "Senha deve conter ao menos um número"),
});

export const signupOrganizationSchema = z.object({
  name: z.string().min(2, "Nome da organização é obrigatório"),
  type: z.enum([
    "CLINICA",
    "CONSULTORIO",
    "PROFISSIONAL_AUTONOMO",
    "ASSOCIACAO",
    "LABORATORIO",
    "OUTRO",
  ]),
  documentType: z.enum(["CPF", "CNPJ"]),
  documentNumber: z
    .string()
    .min(11, "Documento inválido")
    .max(18, "Documento inválido"),
  phone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2),
  type: z.enum([
    "CLINICA",
    "CONSULTORIO",
    "PROFISSIONAL_AUTONOMO",
    "ASSOCIACAO",
    "LABORATORIO",
    "OUTRO",
  ]),
  documentType: z.enum(["CPF", "CNPJ"]),
  documentNumber: z.string().min(11).max(18),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("E-mail inválido"),
  role: z.enum([
    "OWNER",
    "ADMIN",
    "PROFISSIONAL_SAUDE",
    "RECEPCAO",
    "FINANCEIRO",
    "LEITURA",
  ]),
});

export const updateMemberRoleSchema = z.object({
  membershipId: z.string().cuid(),
  role: z.enum([
    "OWNER",
    "ADMIN",
    "PROFISSIONAL_SAUDE",
    "RECEPCAO",
    "FINANCEIRO",
    "LEITURA",
  ]),
});

export const deactivateMemberSchema = z.object({
  membershipId: z.string().cuid(),
});

export const switchOrganizationSchema = z.object({
  organizationId: z.string().cuid(),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2).optional(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupUserInput = z.infer<typeof signupUserSchema>;
export type SignupOrganizationInput = z.infer<typeof signupOrganizationSchema>;
