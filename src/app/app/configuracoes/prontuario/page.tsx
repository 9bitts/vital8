import { requireAuth } from "@/lib/auth/guards";
import { FormTemplateBuilder } from "@/modules/emr/components/form-template-builder";

export default async function ProntuarioConfigPage() {
  await requireAuth(["OWNER", "ADMIN"]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Configurações do prontuário</h1>
        <p className="text-sm text-zinc-500">
          Formulários versionados por especialidade
        </p>
      </div>
      <FormTemplateBuilder />
    </div>
  );
}
