import { requireAuth } from "@/lib/auth/guards";
import { AGENDA_READ_ROLES } from "@/modules/scheduling/lib/permissions";
import { AgendaView } from "@/modules/scheduling/components/agenda-view";

type Props = {
  searchParams: { date?: string; view?: string };
};

export default async function AgendaPage({ searchParams }: Props) {
  await requireAuth([...AGENDA_READ_ROLES]);

  const initialDate = searchParams.date ?? new Date().toISOString();
  const initialView =
    searchParams.view === "week" || searchParams.view === "month"
      ? searchParams.view
      : "day";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <p className="text-sm text-zinc-500">
          Clique duplo em slot vago para agendar · arraste para remarcar
        </p>
      </div>
      <AgendaView initialDate={initialDate} initialView={initialView} />
    </div>
  );
}
