import { requireAuth } from "@/lib/auth/guards";
import { FormTemplateBuilder } from "@/modules/emr/components/form-template-builder";
import { SignatureSettingsPanel } from "@/modules/emr/components/signature-settings-panel";
import { PrescriptionSettingsPanel } from "@/modules/emr/components/prescription-settings-panel";
import { getSignatureSettingsAction } from "@/modules/emr/actions/signature.actions";
import { getPrescriptionSettingsAction } from "@/modules/emr/actions/prescription.actions";

export default async function ProntuarioConfigPage() {
  await requireAuth(["OWNER", "ADMIN"]);
  const [signatureSettings, prescriptionSettings] = await Promise.all([
    getSignatureSettingsAction(),
    getPrescriptionSettingsAction(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações do prontuário</h1>
        <p className="text-sm text-zinc-500">
          Formulários versionados por especialidade, assinatura digital e prescrição
        </p>
      </div>
      <SignatureSettingsPanel initial={signatureSettings} />
      <PrescriptionSettingsPanel initial={prescriptionSettings} />
      <FormTemplateBuilder />
    </div>
  );
}
