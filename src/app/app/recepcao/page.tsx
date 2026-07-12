import { requireAuth } from "@/lib/auth/guards";
import { RECEPTION_ROLES } from "@/modules/scheduling/lib/permissions";
import { ReceptionBoard } from "@/modules/scheduling/components/reception-board";

export default async function RecepcaoPage() {
  await requireAuth([...RECEPTION_ROLES]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Recepção</h1>
        <p className="text-sm text-zinc-500">
          Fila ao vivo, check-in e chamada de pacientes
        </p>
      </div>
      <ReceptionBoard />
    </div>
  );
}
