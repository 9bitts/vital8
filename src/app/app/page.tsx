import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/lib/crypto/search-hash";
import { listBirthdaysAction } from "@/modules/patients/actions/patient.actions";

export default async function AppDashboardPage() {
  const ctx = await requireAuth();
  const birthdays = await listBirthdaysAction("today");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
        <p className="text-zinc-600">
          Bem-vindo ao Vital8, {ctx.userName}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organização ativa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600">
              Seu papel: <strong>{ctx.role}</strong>
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Aniversariantes de hoje</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/pacientes/aniversariantes">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {birthdays.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum aniversariante hoje.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {birthdays.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <Link
                      href={`/app/pacientes/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.fullName}
                    </Link>
                    <span className="text-zinc-500">
                      {p.phones[0] ? formatPhone(p.phones[0].number) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Módulos ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600">
              Pacientes (Fase 2). Agenda, Prontuário e Financeiro nas próximas fases.
            </p>
            <Button className="mt-3" size="sm" asChild>
              <Link href="/app/pacientes">Ir para Pacientes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
