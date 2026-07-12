"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importPatientsCsvAction } from "@/modules/patients/actions/patient.actions";

const COLUMN_MAP: Record<string, string> = {
  nome: "fullName",
  name: "fullName",
  cpf: "cpf",
  telefone: "phone",
  phone: "phone",
  email: "email",
  nascimento: "birthDate",
  birthdate: "birthDate",
  convenio: "insurerName",
  insurer: "insurerName",
  carteirinha: "cardNumber",
  tags: "tags",
};

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0]!.split(/[,;]/).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(/[,;]/).map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      const mapped = COLUMN_MAP[h] ?? h;
      row[mapped] = cols[idx] ?? "";
    });
    if (row.fullName) rows.push(row);
  }

  return rows;
}

export function CsvImportPanel() {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePreview() {
    setPreview(parseCsv(csvText));
    setResult(null);
  }

  function handleImport() {
    startTransition(async () => {
      const rows = parseCsv(csvText);
      const res = await importPatientsCsvAction({ rows, skipDuplicates: true });
      if (!res.success) {
        setResult({ imported: 0, skipped: 0, errors: [res.error] });
        return;
      }
      setResult(res.data!);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <Label htmlFor="csv">CSV (separador , ou ;)</Label>
        <p className="mb-2 text-xs text-zinc-500">
          Colunas: nome, cpf, telefone, email, nascimento, convenio, carteirinha, tags
        </p>
        <Textarea
          id="csv"
          rows={10}
          placeholder={"nome,cpf,telefone\nJoão Silva,12345678901,11999998888"}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handlePreview}>
          Pré-visualizar
        </Button>
        <Button onClick={handleImport} disabled={isPending || !csvText.trim()}>
          {isPending ? "Importando..." : "Importar"}
        </Button>
      </div>

      {preview.length > 0 && (
        <div className="rounded border p-4 text-sm">
          <p className="font-medium mb-2">{preview.length} linha(s) detectada(s)</p>
          <pre className="overflow-auto text-xs">{JSON.stringify(preview.slice(0, 5), null, 2)}</pre>
        </div>
      )}

      {result && (
        <div className="rounded border p-4 text-sm">
          <p>Importados: {result.imported}</p>
          <p>Ignorados (duplicados): {result.skipped}</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 text-red-600">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
