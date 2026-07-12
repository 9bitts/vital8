import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { BirthdayList } from "@/modules/patients/components/birthday-list";
import { listBirthdaysAction } from "@/modules/patients/actions/patient.actions";

type Props = {
  searchParams: { range?: string };
};

export default async function AniversariantesPage({ searchParams }: Props) {
  await requireAuth();
  const range = searchParams.range === "week" ? "week" : "today";
  const patients = await listBirthdaysAction(range);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Aniversariantes</h1>
          <p className="text-zinc-600">Pacientes que fazem aniversário hoje ou esta semana</p>
        </div>
        <div className="flex gap-2">
          <Button variant={range === "today" ? "default" : "outline"} asChild>
            <Link href="/app/pacientes/aniversariantes">Hoje</Link>
          </Button>
          <Button variant={range === "week" ? "default" : "outline"} asChild>
            <Link href="/app/pacientes/aniversariantes?range=week">Semana</Link>
          </Button>
        </div>
      </div>
      <BirthdayList patients={patients} range={range} />
    </div>
  );
}
