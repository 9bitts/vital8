"use client";

import {
  Building2,
  FlaskConical,
  Pill,
  Briefcase,
} from "lucide-react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DOCTOR8_CNPJ_LOGINS = [
  {
    id: "clinica",
    label: "Clínica / CNPJ",
    description: "Consultórios e clínicas cadastradas na Doctor8",
    icon: Building2,
    orgType: "CLINIC",
  },
  {
    id: "empresa",
    label: "Empresa (CNPJ)",
    description: "Saúde ocupacional e empresas parceiras",
    icon: Briefcase,
    orgType: "EMPLOYER",
  },
  {
    id: "farmacia",
    label: "Farmácia (CNPJ)",
    description: "Drogaria e rede de farmácias",
    icon: Pill,
    orgType: "PHARMACY",
  },
  {
    id: "laboratorio",
    label: "Laboratório (CNPJ)",
    description: "Análises clínicas e exames de imagem",
    icon: FlaskConical,
    orgType: "LABORATORY",
  },
] as const;

export type Doctor8OrgType = (typeof DOCTOR8_CNPJ_LOGINS)[number]["orgType"];

export function resolveDoctor8SsoError(code: string | undefined): string | null {
  switch (code) {
    case "Doctor8EmailNaoVerificado":
      return "Confirme seu e-mail na Doctor8 antes de entrar.";
    case "Doctor8ContaInvalida":
      return "Apenas contas Doctor8 de clínica, empresa, farmácia ou laboratório podem acessar o vital8.";
    case "Doctor8SemConta":
      return "Seu e-mail Doctor8 não está cadastrado no vital8. Peça um convite ao administrador.";
    case "Doctor8SemOrganizacao":
      return "Sua conta não está vinculada a nenhuma clínica ativa no vital8.";
    case "Doctor8CnpjDivergente":
      return "O CNPJ da sua conta Doctor8 não confere com o da organização no vital8. Contate o suporte.";
    case "AccessDenied":
      return "Não foi possível entrar com Doctor8. Tente novamente ou use e-mail e senha.";
    default:
      return null;
  }
}

export function signInWithDoctor8(orgType?: Doctor8OrgType) {
  void signIn(
    "doctor8",
    { callbackUrl: "/app" },
    orgType ? { account_type: orgType } : undefined,
  );
}

type Doctor8LoginCtasProps = {
  variant?: "primary" | "stack" | "grid";
  className?: string;
};

export function Doctor8LoginCtas({
  variant = "primary",
  className,
}: Doctor8LoginCtasProps) {
  if (variant === "primary") {
    return (
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={() => signInWithDoctor8()}
      >
        Entrar com Doctor8
      </Button>
    );
  }

  if (variant === "stack") {
    return (
      <div className={cn("space-y-2", className)}>
        <Button type="button" variant="outline" className="w-full" onClick={() => signInWithDoctor8()}>
          Entrar com Doctor8
        </Button>
        <div className="grid gap-2 pt-1">
          {DOCTOR8_CNPJ_LOGINS.map((entry) => {
            const Icon = entry.icon;
            return (
              <Button
                key={entry.id}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start gap-3 px-3 py-2.5 text-left"
                onClick={() => signInWithDoctor8(entry.orgType)}
              >
                <Icon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-900">
                    {entry.label}
                  </span>
                  <span className="block text-xs font-normal text-zinc-500">
                    {entry.description}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Button type="button" size="lg" className="w-full sm:w-auto" onClick={() => signInWithDoctor8()}>
        Entrar com Doctor8
      </Button>
      <div className="grid gap-3 sm:grid-cols-2">
        {DOCTOR8_CNPJ_LOGINS.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => signInWithDoctor8(entry.orgType)}
              className="rounded-lg border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <div className="mb-2 flex items-center gap-2 text-zinc-900">
                <Icon className="h-4 w-4 text-zinc-500" aria-hidden />
                <span className="text-sm font-semibold">{entry.label}</span>
              </div>
              <p className="text-sm text-zinc-600">{entry.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
