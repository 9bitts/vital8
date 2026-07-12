"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveFormTemplateAction } from "@/modules/emr/actions/emr.actions";

export function FormTemplateBuilder() {
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fields, setFields] = useState<
    { id: string; type: "TEXT"; label: string; required: boolean }[]
  >([]);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  function addField() {
    if (!fieldLabel) return;
    setFields((f) => [
      ...f,
      {
        id: `f-${Date.now()}`,
        type: "TEXT",
        label: fieldLabel,
        required: false,
      },
    ]);
    setFieldLabel("");
  }

  function save() {
    startTransition(async () => {
      const r = await saveFormTemplateAction({ name, specialty, fields });
      setMsg(r.success ? "Formulário salvo (v1)" : r.error);
    });
  }

  return (
    <div className="space-y-3 rounded border p-4">
      <h3 className="font-medium">Construtor de formulários</h3>
      <div>
        <Label>Nome</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Especialidade</Label>
        <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Rótulo do campo"
          value={fieldLabel}
          onChange={(e) => setFieldLabel(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={addField}>
          + Campo
        </Button>
      </div>
      <ul className="text-sm">
        {fields.map((f) => (
          <li key={f.id}>{f.label}</li>
        ))}
      </ul>
      <Button onClick={save} disabled={pending || !name || fields.length === 0}>
        Salvar template
      </Button>
      {msg && <p className="text-sm text-zinc-600">{msg}</p>}
    </div>
  );
}
