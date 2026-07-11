"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { signupAction, postLoginSignIn } from "@/modules/core/actions/auth.actions";

const ORG_TYPES = [
  { value: "CLINICA", label: "Clínica" },
  { value: "CONSULTORIO", label: "Consultório" },
  { value: "PROFISSIONAL_AUTONOMO", label: "Profissional autônomo" },
  { value: "ASSOCIACAO", label: "Associação de saúde" },
  { value: "LABORATORIO", label: "Laboratório" },
  { value: "OUTRO", label: "Outro" },
] as const;

export function SignupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [userData, setUserData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [orgData, setOrgData] = useState({
    name: "",
    type: "CLINICA" as const,
    documentType: "CNPJ" as const,
    documentNumber: "",
    phone: "",
    email: "",
  });

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    const result = await signupAction(userData, orgData);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    await postLoginSignIn(userData.email, userData.password);
    router.push("/app");
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>
          Passo {step} de 2 — {step === 1 ? "Seus dados" : "Sua organização"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 1 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={userData.name}
                onChange={(e) =>
                  setUserData({ ...userData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={userData.email}
                onChange={(e) =>
                  setUserData({ ...userData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={userData.password}
                onChange={(e) =>
                  setUserData({ ...userData, password: e.target.value })
                }
              />
              <p className="text-xs text-zinc-500">
                Mínimo 8 caracteres, 1 maiúscula e 1 número
              </p>
            </div>
            <Button className="w-full" onClick={() => setStep(2)}>
              Continuar
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="orgName">Nome da organização</Label>
              <Input
                id="orgName"
                value={orgData.name}
                onChange={(e) =>
                  setOrgData({ ...orgData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={orgData.type}
                onValueChange={(value) =>
                  setOrgData({
                    ...orgData,
                    type: value as typeof orgData.type,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Documento</Label>
                <Select
                  value={orgData.documentType}
                  onValueChange={(value) =>
                    setOrgData({
                      ...orgData,
                      documentType: value as typeof orgData.documentType,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CPF">CPF</SelectItem>
                    <SelectItem value="CNPJ">CNPJ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="documentNumber">Número</Label>
                <Input
                  id="documentNumber"
                  value={orgData.documentNumber}
                  onChange={(e) =>
                    setOrgData({
                      ...orgData,
                      documentNumber: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (opcional)</Label>
              <Input
                id="phone"
                value={orgData.phone}
                onChange={(e) =>
                  setOrgData({ ...orgData, phone: e.target.value })
                }
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
                {loading ? "Criando..." : "Criar conta"}
              </Button>
            </div>
          </>
        )}

        <p className="text-center text-sm text-zinc-500">
          Já tem conta?{" "}
          <Link href="/entrar" className="text-zinc-900 underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
