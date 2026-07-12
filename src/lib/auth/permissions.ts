import type { Role } from "@/generated/prisma/client";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve";

export type PermissionModule =
  | "pacientes"
  | "agenda"
  | "prontuario"
  | "financeiro"
  | "faturamento"
  | "estoque"
  | "relatorios"
  | "configuracoes";

export type PermissionMatrix = Partial<
  Record<PermissionModule, Partial<Record<PermissionAction, boolean>>>
>;

export type PermissionLimits = {
  maxDiscountPercent?: number;
  maxRefundCents?: number;
  allowSqueeze?: boolean;
};

export type PermissionKey =
  | `${PermissionModule}.${PermissionAction}`
  | "financeiro.estornar"
  | "agenda.encaixe";

const MODULE_ACTIONS: Record<PermissionModule, PermissionAction[]> = {
  pacientes: ["view", "create", "edit", "delete"],
  agenda: ["view", "create", "edit", "delete", "approve"],
  prontuario: ["view", "create", "edit", "delete", "approve"],
  financeiro: ["view", "create", "edit", "delete", "approve"],
  faturamento: ["view", "create", "edit", "delete", "approve"],
  estoque: ["view", "create", "edit", "delete"],
  relatorios: ["view"],
  configuracoes: ["view", "edit"],
};

function fullModule(actions: PermissionAction[], enabled = true): Partial<Record<PermissionAction, boolean>> {
  return Object.fromEntries(actions.map((a) => [a, enabled])) as Partial<Record<PermissionAction, boolean>>;
}

export const DEFAULT_PROFILES: Record<
  Role,
  { name: string; permissions: PermissionMatrix; limits: PermissionLimits }
> = {
  OWNER: {
    name: "Proprietário",
    permissions: Object.fromEntries(
      Object.entries(MODULE_ACTIONS).map(([m, actions]) => [m, fullModule(actions)]),
    ) as PermissionMatrix,
    limits: { maxDiscountPercent: 100, maxRefundCents: 99999999, allowSqueeze: true },
  },
  ADMIN: {
    name: "Administrador",
    permissions: {
      ...Object.fromEntries(
        Object.entries(MODULE_ACTIONS).map(([m, actions]) => [m, fullModule(actions)]),
      ),
      configuracoes: { view: true, edit: false },
    } as PermissionMatrix,
    limits: { maxDiscountPercent: 50, maxRefundCents: 500000, allowSqueeze: true },
  },
  PROFISSIONAL_SAUDE: {
    name: "Profissional de saúde",
    permissions: {
      pacientes: { view: true, create: false, edit: true },
      agenda: { view: true, create: false, edit: true },
      prontuario: { view: true, create: true, edit: true, approve: true },
      financeiro: { view: false },
      faturamento: { view: true },
      estoque: { view: true },
      relatorios: { view: true },
      configuracoes: { view: false },
    },
    limits: { maxDiscountPercent: 0, maxRefundCents: 0, allowSqueeze: false },
  },
  RECEPCAO: {
    name: "Recepção",
    permissions: {
      pacientes: { view: true, create: true, edit: true },
      agenda: { view: true, create: true, edit: true, approve: true },
      prontuario: { view: false },
      financeiro: { view: true, create: true },
      faturamento: { view: false },
      estoque: { view: false },
      relatorios: { view: true },
      configuracoes: { view: false },
    },
    limits: { maxDiscountPercent: 10, maxRefundCents: 0, allowSqueeze: true },
  },
  FINANCEIRO: {
    name: "Financeiro",
    permissions: {
      pacientes: { view: true },
      agenda: { view: true },
      prontuario: { view: false },
      financeiro: fullModule(MODULE_ACTIONS.financeiro),
      faturamento: { view: true, create: true, edit: true, approve: true },
      estoque: { view: false },
      relatorios: { view: true },
      configuracoes: { view: false },
    },
    limits: { maxDiscountPercent: 30, maxRefundCents: 1000000, allowSqueeze: false },
  },
  ESTOQUE: {
    name: "Estoque",
    permissions: {
      pacientes: { view: false },
      agenda: { view: false },
      prontuario: { view: false },
      financeiro: { view: false },
      faturamento: { view: false },
      estoque: fullModule(MODULE_ACTIONS.estoque),
      relatorios: { view: true },
      configuracoes: { view: false },
    },
    limits: { maxDiscountPercent: 0, maxRefundCents: 0, allowSqueeze: false },
  },
  LEITURA: {
    name: "Somente leitura",
    permissions: Object.fromEntries(
      Object.entries(MODULE_ACTIONS).map(([m, actions]) => [
        m,
        fullModule(actions.filter((a) => a === "view"), true),
      ]),
    ) as PermissionMatrix,
    limits: { maxDiscountPercent: 0, maxRefundCents: 0, allowSqueeze: false },
  },
};

export function resolvePermissionKey(key: PermissionKey): { module: PermissionModule; action: PermissionAction } {
  if (key === "financeiro.estornar") return { module: "financeiro", action: "approve" };
  if (key === "agenda.encaixe") return { module: "agenda", action: "approve" };
  const [module, action] = key.split(".") as [PermissionModule, PermissionAction];
  return { module, action };
}

export function checkPermission(
  matrix: PermissionMatrix,
  key: PermissionKey,
  role: Role,
): boolean {
  const fallback = DEFAULT_PROFILES[role]?.permissions ?? {};
  const { module, action } = resolvePermissionKey(key);
  const custom = matrix[module]?.[action];
  if (custom !== undefined) return custom;
  return fallback[module]?.[action] ?? false;
}

export function getLimits(
  limits: PermissionLimits | null | undefined,
  role: Role,
): PermissionLimits {
  return { ...DEFAULT_PROFILES[role].limits, ...limits };
}
