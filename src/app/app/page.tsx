import { auth } from "@/lib/auth/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AppDashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
        <p className="text-zinc-600">
          Bem-vindo ao Vital8, {session?.user?.name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organização ativa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600">
              Seu papel: <strong>{session?.role}</strong>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Módulos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600">
              Agenda, Pacientes, Prontuário e Financeiro chegam nas próximas
              fases.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fase 1 concluída</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600">
              Fundação multi-tenant, autenticação, RBAC e auditoria ativos.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
