import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";

export default async function MobilePacientesPage() {
  const ctx = await requireAuth();
  const patients = await ctx.db.patient.findMany({
    where: { isActive: true },
    take: 30,
    orderBy: { searchName: "asc" },
    select: { id: true, fullName: true, socialName: true },
  });

  return (
    <div className="space-y-3">
      <h2 className="font-medium">Pacientes</h2>
      <ul className="space-y-2">
        {patients.map((p) => (
          <li key={p.id}>
            <Link
              href={`/m/pacientes/${p.id}`}
              className="flex min-h-11 items-center rounded-lg border px-4 py-3 dark:border-zinc-800"
            >
              {p.socialName ?? p.fullName}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
