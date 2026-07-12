"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createPatientAction,
  updatePatientContactAction,
  updatePatientPersonalAction,
  upsertAllergyAction,
  upsertChronicConditionAction,
  upsertInsurancePlanAction,
  upsertMedicationAction,
  recordConsentAction,
  uploadPatientDocumentAction,
  deleteInsurancePlanAction,
} from "@/modules/patients/actions/patient.actions";
import type { LgpdExportData } from "@/modules/patients/services/patient.service";

type Props = {
  patientId?: string;
  initialData?: LgpdExportData;
  mode: "create" | "edit";
};

export function PatientForm({ patientId, initialData, mode }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  const p = initialData?.patient;

  async function handlePersonalSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const form = new FormData(e.currentTarget);
    const tagsRaw = (form.get("tags") as string) || "";
    const data = {
      fullName: form.get("fullName") as string,
      socialName: (form.get("socialName") as string) || undefined,
      cpf: (form.get("cpf") as string) || undefined,
      rg: (form.get("rg") as string) || undefined,
      birthDate: (form.get("birthDate") as string) || undefined,
      sex: (form.get("sex") as string) || undefined,
      genderIdentity: (form.get("genderIdentity") as string) || undefined,
      maritalStatus: (form.get("maritalStatus") as string) || undefined,
      profession: (form.get("profession") as string) || undefined,
      referralSource: (form.get("referralSource") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
      tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
      isActive: form.get("isActive") === "on",
    };

    startTransition(async () => {
      if (mode === "create") {
        const contact = {
          phones: [{ number: form.get("phone") as string }],
          email: (form.get("email") as string) || undefined,
        };
        const result = await createPatientAction(data, contact);
        if (!result.success) {
          setError(result.error);
          return;
        }
        router.push(`/app/pacientes/${result.data!.id}/editar`);
      } else if (patientId) {
        const result = await updatePatientPersonalAction(patientId, data);
        if (!result.success) {
          setError(result.error);
          return;
        }
        setSuccess("Dados pessoais salvos");
        router.refresh();
      }
    });
  }

  async function handleContactSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!patientId) return;
    setError("");
    const form = new FormData(e.currentTarget);
    const data = {
      phones: [{ number: form.get("phone") as string }],
      email: (form.get("email") as string) || undefined,
      address: {
        cep: (form.get("cep") as string) || undefined,
        street: (form.get("street") as string) || undefined,
        number: (form.get("number") as string) || undefined,
        complement: (form.get("complement") as string) || undefined,
        neighborhood: (form.get("neighborhood") as string) || undefined,
        city: (form.get("city") as string) || undefined,
        state: (form.get("state") as string) || undefined,
      },
    };
    startTransition(async () => {
      const result = await updatePatientContactAction(patientId, data);
      if (!result.success) setError(result.error);
      else {
        setSuccess("Contato salvo");
        router.refresh();
      }
    });
  }

  async function handleInsuranceSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!patientId) return;
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await upsertInsurancePlanAction(patientId, {
        insurerName: form.get("insurerName") as string,
        planName: (form.get("planName") as string) || undefined,
        cardNumber: form.get("cardNumber") as string,
        validUntil: (form.get("validUntil") as string) || undefined,
        isPrimary: true,
      });
      if (!result.success) setError(result.error);
      else {
        setSuccess("Convênio salvo");
        router.refresh();
      }
    });
  }

  async function handleHealthSubmit(type: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!patientId) return;
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      let result;
      if (type === "allergy") {
        result = await upsertAllergyAction(patientId, {
          substance: form.get("substance") as string,
          severity: (form.get("severity") as string) || undefined,
          notes: (form.get("notes") as string) || undefined,
        });
      } else if (type === "condition") {
        result = await upsertChronicConditionAction(patientId, {
          condition: form.get("condition") as string,
          cidCode: (form.get("cidCode") as string) || undefined,
          notes: (form.get("notes") as string) || undefined,
        });
      } else {
        result = await upsertMedicationAction(patientId, {
          name: form.get("name") as string,
          dosage: (form.get("dosage") as string) || undefined,
          frequency: (form.get("frequency") as string) || undefined,
        });
      }
      if (result && !result.success) setError(result.error);
      else {
        setSuccess("Registro de saúde salvo");
        router.refresh();
      }
    });
  }

  async function handleConsentSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!patientId) return;
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await recordConsentAction(patientId, {
        termKey: form.get("termKey") as string,
        termVersion: form.get("termVersion") as string,
        purpose: form.get("purpose") as string,
        channel: form.get("channel") as "PRESENCIAL",
      });
      if (!result.success) setError(result.error);
      else {
        setSuccess("Consentimento registrado");
        router.refresh();
      }
    });
  }

  async function handleDocumentUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!patientId) return;
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await uploadPatientDocumentAction(patientId, form);
      if (!result.success) setError(result.error);
      else {
        setSuccess("Documento enviado");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Dados pessoais</TabsTrigger>
          {mode === "edit" && (
            <>
              <TabsTrigger value="contact">Contato</TabsTrigger>
              <TabsTrigger value="insurance">Convênios</TabsTrigger>
              <TabsTrigger value="health">Saúde</TabsTrigger>
              <TabsTrigger value="documents">Documentos</TabsTrigger>
              <TabsTrigger value="lgpd">LGPD</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="personal">
          <form onSubmit={handlePersonalSubmit} className="max-w-xl space-y-4 pt-4">
            <div>
              <Label htmlFor="fullName">Nome completo *</Label>
              <Input id="fullName" name="fullName" defaultValue={p?.fullName} required />
            </div>
            <div>
              <Label htmlFor="socialName">Nome social</Label>
              <Input id="socialName" name="socialName" defaultValue={p?.socialName ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" name="cpf" defaultValue={p?.cpf ?? ""} />
              </div>
              <div>
                <Label htmlFor="rg">RG</Label>
                <Input id="rg" name="rg" defaultValue={p?.rg ?? ""} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="birthDate">Nascimento</Label>
                <Input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  defaultValue={
                    p?.birthDate
                      ? new Date(p.birthDate).toISOString().slice(0, 10)
                      : ""
                  }
                />
              </div>
              <div>
                <Label htmlFor="sex">Sexo</Label>
                <select
                  id="sex"
                  name="sex"
                  defaultValue={p?.sex ?? ""}
                  className="flex h-10 w-full rounded-md border border-zinc-200 px-3 text-sm"
                >
                  <option value="">—</option>
                  <option value="MASCULINO">Masculino</option>
                  <option value="FEMININO">Feminino</option>
                  <option value="INTERSEX">Intersexo</option>
                  <option value="NAO_INFORMADO">Não informado</option>
                </select>
              </div>
            </div>
            {mode === "create" && (
              <>
                <div>
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input id="phone" name="phone" required />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="profession">Profissão</Label>
              <Input id="profession" name="profession" defaultValue={p?.profession ?? ""} />
            </div>
            <div>
              <Label htmlFor="referralSource">Como conheceu a clínica</Label>
              <Input id="referralSource" name="referralSource" defaultValue={p?.referralSource ?? ""} />
            </div>
            <div>
              <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
              <Input id="tags" name="tags" defaultValue={p?.tags.join(", ") ?? ""} />
            </div>
            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" name="notes" defaultValue={p?.notes ?? ""} />
            </div>
            {mode === "edit" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked={p?.isActive} />
                Paciente ativo
              </label>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </TabsContent>

        {mode === "edit" && patientId && (
          <>
            <TabsContent value="contact">
              <form onSubmit={handleContactSubmit} className="max-w-xl space-y-4 pt-4">
                <div>
                  <Label htmlFor="phone">Telefone principal</Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={p?.phones[0]?.number ?? ""}
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" defaultValue={p?.email ?? ""} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="cep">CEP</Label>
                    <Input id="cep" name="cep" defaultValue={p?.address?.cep ?? ""} />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="street">Logradouro</Label>
                    <Input id="street" name="street" defaultValue={p?.address?.street ?? ""} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="number">Número</Label>
                    <Input id="number" name="number" defaultValue={p?.address?.number ?? ""} />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="complement">Complemento</Label>
                    <Input id="complement" name="complement" defaultValue={p?.address?.complement ?? ""} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="neighborhood">Bairro</Label>
                    <Input id="neighborhood" name="neighborhood" defaultValue={p?.address?.neighborhood ?? ""} />
                  </div>
                  <div>
                    <Label htmlFor="city">Cidade</Label>
                    <Input id="city" name="city" defaultValue={p?.address?.city ?? ""} />
                  </div>
                  <div>
                    <Label htmlFor="state">UF</Label>
                    <Input id="state" name="state" maxLength={2} defaultValue={p?.address?.state ?? ""} />
                  </div>
                </div>
                <Button type="submit" disabled={isPending}>Salvar contato</Button>
              </form>
            </TabsContent>

            <TabsContent value="insurance">
              <div className="space-y-4 pt-4">
                {initialData?.insurancePlans.map((plan) => (
                  <div key={plan.id} className="rounded border p-3 text-sm">
                    <div className="font-medium">{plan.insurerName}</div>
                    <div>Carteirinha: {plan.cardNumber}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() =>
                        startTransition(async () => {
                          await deleteInsurancePlanAction(patientId, plan.id);
                          router.refresh();
                        })
                      }
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <form onSubmit={handleInsuranceSubmit} className="max-w-xl space-y-3">
                  <div>
                    <Label htmlFor="insurerName">Convênio</Label>
                    <Input id="insurerName" name="insurerName" required />
                  </div>
                  <div>
                    <Label htmlFor="planName">Plano</Label>
                    <Input id="planName" name="planName" />
                  </div>
                  <div>
                    <Label htmlFor="cardNumber">Número da carteirinha</Label>
                    <Input id="cardNumber" name="cardNumber" required />
                  </div>
                  <div>
                    <Label htmlFor="validUntil">Validade</Label>
                    <Input id="validUntil" name="validUntil" type="date" />
                  </div>
                  <Button type="submit" disabled={isPending}>Adicionar convênio</Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="health">
              <div className="grid gap-6 pt-4 md:grid-cols-3">
                <form onSubmit={(e) => handleHealthSubmit("allergy", e)} className="space-y-2 rounded border p-4">
                  <h3 className="font-medium">Alergia</h3>
                  <Input name="substance" placeholder="Substância" required />
                  <Input name="severity" placeholder="Gravidade" />
                  <Button type="submit" size="sm" disabled={isPending}>Adicionar</Button>
                  <ul className="mt-2 space-y-1 text-sm">
                    {initialData?.allergies.map((a) => (
                      <li key={a.id}>• {a.substance}</li>
                    ))}
                  </ul>
                </form>
                <form onSubmit={(e) => handleHealthSubmit("condition", e)} className="space-y-2 rounded border p-4">
                  <h3 className="font-medium">Condição crônica</h3>
                  <Input name="condition" placeholder="Condição" required />
                  <Input name="cidCode" placeholder="CID-10" />
                  <Button type="submit" size="sm" disabled={isPending}>Adicionar</Button>
                  <ul className="mt-2 space-y-1 text-sm">
                    {initialData?.chronicConditions.map((c) => (
                      <li key={c.id}>• {c.condition}</li>
                    ))}
                  </ul>
                </form>
                <form onSubmit={(e) => handleHealthSubmit("medication", e)} className="space-y-2 rounded border p-4">
                  <h3 className="font-medium">Medicamento em uso</h3>
                  <Input name="name" placeholder="Medicamento" required />
                  <Input name="dosage" placeholder="Dosagem" />
                  <Input name="frequency" placeholder="Frequência" />
                  <Button type="submit" size="sm" disabled={isPending}>Adicionar</Button>
                  <ul className="mt-2 space-y-1 text-sm">
                    {initialData?.medications.map((m) => (
                      <li key={m.id}>• {m.name}</li>
                    ))}
                  </ul>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="documents">
              <div className="space-y-4 pt-4">
                <ul className="space-y-2 text-sm">
                  {initialData?.documents.map((d) => (
                    <li key={d.id} className="flex justify-between rounded border p-2">
                      <span>{d.fileName}</span>
                      <a
                        href={`/api/pacientes/${patientId}/documentos/${d.id}`}
                        className="text-blue-600 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Baixar
                      </a>
                    </li>
                  ))}
                </ul>
                <form onSubmit={handleDocumentUpload} className="max-w-xl space-y-3">
                  <div>
                    <Label htmlFor="file">Arquivo</Label>
                    <Input id="file" name="file" type="file" required />
                  </div>
                  <div>
                    <Label htmlFor="category">Categoria</Label>
                    <select id="category" name="category" className="flex h-10 w-full rounded-md border px-3 text-sm">
                      <option value="RG">RG</option>
                      <option value="CPF">CPF</option>
                      <option value="COMPROVANTE_RESIDENCIA">Comprovante</option>
                      <option value="CARTEIRINHA_CONVENIO">Carteirinha</option>
                      <option value="EXAME">Exame</option>
                      <option value="OUTRO">Outro</option>
                    </select>
                  </div>
                  <Button type="submit" disabled={isPending}>Enviar documento</Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="lgpd">
              <div className="space-y-4 pt-4">
                <form onSubmit={handleConsentSubmit} className="max-w-xl space-y-3 rounded border p-4">
                  <h3 className="font-medium">Registrar consentimento</h3>
                  <Input name="termKey" placeholder="Chave do termo (ex: lgpd-geral)" required />
                  <Input name="termVersion" placeholder="Versão (ex: 1.0)" required />
                  <Input name="purpose" placeholder="Finalidade" required />
                  <select name="channel" className="flex h-10 w-full rounded-md border px-3 text-sm" defaultValue="PRESENCIAL">
                    <option value="PRESENCIAL">Presencial</option>
                    <option value="DIGITAL">Digital</option>
                    <option value="TELEFONE">Telefone</option>
                  </select>
                  <Button type="submit" size="sm" disabled={isPending}>Registrar</Button>
                </form>
                <ul className="text-sm space-y-1">
                  {initialData?.consents.map((c) => (
                    <li key={c.id} className="rounded border p-2">
                      {c.termKey} v{c.termVersion} — {c.purpose} ({c.channel})
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
