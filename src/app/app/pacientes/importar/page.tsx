import { requireAuth } from "@/lib/auth/guards";
import { CsvImportPanel } from "@/modules/patients/components/csv-import-panel";

export default async function ImportarPacientesPage() {
  await requireAuth(["OWNER", "ADMIN"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importar pacientes</h1>
        <p className="text-zinc-600">Importação em lote via CSV com relatório de erros</p>
      </div>
      <CsvImportPanel />
    </div>
  );
}
