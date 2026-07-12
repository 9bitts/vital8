import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { PatientList } from "@/modules/patients/components/patient-list";
import {
  listPatientsAction,
  getPatientTagsAction,
  getPatientInsurersAction,
} from "@/modules/patients/actions/patient.actions";

type Props = {
  searchParams: {
    q?: string;
    tag?: string;
    insurer?: string;
    inativos?: string;
    page?: string;
    sort?: string;
    order?: string;
  };
};

export default async function PacientesPage({ searchParams }: Props) {
  await requireAuth();

  const page = parseInt(searchParams.page ?? "1", 10);
  const sortBy = (searchParams.sort ?? "fullName") as "fullName" | "createdAt" | "birthDate";
  const sortOrder = (searchParams.order ?? "asc") as "asc" | "desc";

  const result = await listPatientsAction({
    query: searchParams.q,
    tag: searchParams.tag,
    insurer: searchParams.insurer,
    includeInactive: searchParams.inativos === "1",
    page,
    pageSize: 20,
    sortBy,
    sortOrder,
  });

  const [tags, insurers] = await Promise.all([
    getPatientTagsAction(),
    getPatientInsurersAction(),
  ]);

  if (!result.success || !result.data) {
    return <p className="text-red-600">Erro ao carregar pacientes</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pacientes</h1>
          <p className="text-zinc-600">CRM clínico — cadastro e gestão de pacientes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/app/pacientes/aniversariantes">Aniversariantes</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/app/pacientes/duplicados">Duplicados</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/app/pacientes/importar">Importar CSV</Link>
          </Button>
        </div>
      </div>

      <PatientList
        initialData={result.data}
        tags={tags}
        insurers={insurers}
        initialQuery={searchParams.q}
        initialTag={searchParams.tag}
        initialInsurer={searchParams.insurer}
        initialIncludeInactive={searchParams.inativos === "1"}
        initialSortBy={sortBy}
        initialSortOrder={sortOrder}
      />
    </div>
  );
}
