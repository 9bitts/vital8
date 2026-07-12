"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { mergePatientsAction } from "@/modules/patients/actions/patient.actions";
import type { DecryptedPatient } from "@/modules/patients/services/patient.service";

type DuplicateGroup = {
  reason: "cpf" | "name_birth";
  patients: DecryptedPatient[];
};

type Props = {
  groups: DuplicateGroup[];
};

export function DuplicateMergePanel({ groups }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<DuplicateGroup | null>(
    groups[0] ?? null,
  );
  const [primaryId, setPrimaryId] = useState("");
  const [secondaryId, setSecondaryId] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function selectGroup(group: DuplicateGroup) {
    setSelected(group);
    setPrimaryId(group.patients[0]?.id ?? "");
    setSecondaryId(group.patients[1]?.id ?? "");
    setError("");
  }

  function handleMerge() {
    if (!primaryId || !secondaryId) {
      setError("Selecione os dois registros");
      return;
    }
    startTransition(async () => {
      const result = await mergePatientsAction({
        primaryPatientId: primaryId,
        secondaryPatientId: secondaryId,
        fieldChoices: {
          fullName: "primary",
          socialName: "primary",
          cpf: "primary",
          birthDate: "primary",
          phone: "primary",
          email: "primary",
        },
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/app/pacientes/${result.data!.id}`);
      router.refresh();
    });
  }

  if (groups.length === 0) {
    return (
      <p className="text-zinc-600">Nenhum possível duplicado encontrado.</p>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2">
        <h2 className="font-medium">Grupos detectados</h2>
        {groups.map((group, i) => (
          <button
            key={i}
            type="button"
            onClick={() => selectGroup(group)}
            className={`w-full rounded border p-3 text-left text-sm ${
              selected === group ? "border-zinc-900 bg-zinc-50" : ""
            }`}
          >
            <div className="font-medium">
              {group.reason === "cpf" ? "CPF igual" : "Nome + nascimento"}
            </div>
            <div className="text-zinc-500">
              {group.patients.map((p) => p.fullName).join(" / ")}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="space-y-4 rounded border p-4">
          <h2 className="font-medium">Mesclar registros</h2>
          <div>
            <Label>Registro principal (mantido)</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border px-3 text-sm"
              value={primaryId}
              onChange={(e) => setPrimaryId(e.target.value)}
            >
              {selected.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Registro secundário (será arquivado)</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border px-3 text-sm"
              value={secondaryId}
              onChange={(e) => setSecondaryId(e.target.value)}
            >
              {selected.patients
                .filter((p) => p.id !== primaryId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={handleMerge} disabled={isPending}>
            {isPending ? "Mesclando..." : "Confirmar mesclagem"}
          </Button>
        </div>
      )}
    </div>
  );
}
