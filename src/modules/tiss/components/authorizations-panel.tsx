"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAuthorizationAction } from "@/modules/tiss/actions/tiss.actions";

type Auth = Awaited<
  ReturnType<typeof import("@/modules/tiss/actions/tiss.actions").listAuthorizationsAction>
>[number];
type Insurer = { id: string; name: string };
type Patient = { id: string; fullName: string };
type Service = { id: string; name: string };

type Props = {
  authorizations: Auth[];
  expiring: Auth[];
  insurers: Insurer[];
  patients: Patient[];
  services: Service[];
};

export function AuthorizationsPanel({
  authorizations,
  expiring,
  insurers,
  patients,
  services,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-6">
      {expiring.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <h3 className="font-medium text-amber-800">Expirando em 7 dias</h3>
          <ul className="text-sm mt-2 space-y-1">
            {expiring.map((a) => (
              <li key={a.id}>
                {a.patient.fullName} — {a.healthInsurer.name} — validade{" "}
                {a.validUntil?.toISOString().slice(0, 10)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        className="grid gap-2 md:grid-cols-2 rounded border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await saveAuthorizationAction({
              healthInsurerId: fd.get("healthInsurerId"),
              patientId: fd.get("patientId"),
              serviceId: fd.get("serviceId"),
              password: fd.get("password"),
              validUntil: fd.get("validUntil"),
              authorizedQty: Number(fd.get("authorizedQty") || 1),
              status: "AUTORIZADA",
            });
            setMessage(r.success ? "Autorização registrada" : ("error" in r ? r.error : "Erro"));
          });
        }}
      >
        <div>
          <Label>Operadora</Label>
          <select name="healthInsurerId" className="w-full rounded border px-2 py-2" required>
            {insurers.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Paciente</Label>
          <select name="patientId" className="w-full rounded border px-2 py-2" required>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Serviço</Label>
          <select name="serviceId" className="w-full rounded border px-2 py-2">
            <option value="">—</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div><Label>Senha</Label><Input name="password" required /></div>
        <div><Label>Validade</Label><Input name="validUntil" type="date" required /></div>
        <div><Label>Qtd autorizada</Label><Input name="authorizedQty" type="number" defaultValue={1} /></div>
        <Button type="submit" disabled={pending}>Registrar autorização</Button>
      </form>

      <div className="rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="p-2 text-left">Paciente</th>
              <th className="p-2 text-left">Operadora</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Senha</th>
              <th className="p-2 text-left">Validade</th>
              <th className="p-2 text-left">Consumo</th>
            </tr>
          </thead>
          <tbody>
            {authorizations.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-2">{a.patient.fullName}</td>
                <td className="p-2">{a.healthInsurer.name}</td>
                <td className="p-2"><Badge>{a.status}</Badge></td>
                <td className="p-2">{a.password ?? "—"}</td>
                <td className="p-2">{a.validUntil?.toISOString().slice(0, 10) ?? "—"}</td>
                <td className="p-2">{a.consumedQty}/{a.authorizedQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && <p className="text-sm text-green-700">{message}</p>}
    </div>
  );
}
