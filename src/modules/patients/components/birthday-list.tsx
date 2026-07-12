import Link from "next/link";
import { formatPhone } from "@/lib/crypto/search-hash";
import type { DecryptedPatient } from "@/modules/patients/services/patient.service";

type Props = {
  patients: DecryptedPatient[];
  range: "today" | "week";
};

export function BirthdayList({ patients, range }: Props) {
  const title = range === "today" ? "Aniversariantes de hoje" : "Aniversariantes da semana";

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">{title}</h2>
      {patients.length === 0 ? (
        <p className="text-zinc-500">Nenhum aniversariante neste período.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {patients.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link
                  href={`/app/pacientes/${p.id}`}
                  className="font-medium hover:underline"
                >
                  {p.fullName}
                </Link>
                {p.birthDate && (
                  <p className="text-sm text-zinc-500">
                    {new Date(p.birthDate).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                    })}
                  </p>
                )}
              </div>
              <span className="text-sm text-zinc-600">
                {p.phones[0] ? formatPhone(p.phones[0].number) : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
