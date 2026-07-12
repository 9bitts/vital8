"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  listPermissionProfilesAction,
  savePermissionProfileAction,
} from "@/modules/admin/actions/admin.actions";
import { DEFAULT_PROFILES } from "@/lib/auth/permissions";
import type { Role } from "@/generated/prisma/client";

export default function PermissoesPage() {
  const [profiles, setProfiles] = useState<Awaited<ReturnType<typeof listPermissionProfilesAction>>>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => setProfiles(await listPermissionProfilesAction()));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Perfis de permissão</h1>
      <p className="text-sm text-zinc-600">
        Matriz recurso × ação. Perfis padrão por papel; crie customizações sobrepondo o papel base.
      </p>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await savePermissionProfileAction({
              name: "Recepção sem prontuário",
              permissions: {
                ...DEFAULT_PROFILES.RECEPCAO.permissions,
                prontuario: { view: false, create: false, edit: false },
              },
              limits: DEFAULT_PROFILES.RECEPCAO.limits,
            });
            setProfiles(await listPermissionProfilesAction());
          })
        }
      >
        Criar perfil custom (exemplo)
      </Button>
      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-zinc-50 text-left">
            <th className="p-2">Nome</th>
            <th className="p-2">Papel base</th>
            <th className="p-2">Padrão</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.name}</td>
              <td className="p-2">{p.roleTemplate ?? "—"}</td>
              <td className="p-2">{p.isDefault ? "Sim" : "Custom"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className="text-xs text-zinc-500">
        <summary>Papéis padrão (referência)</summary>
        <pre className="mt-2 overflow-auto">{JSON.stringify(Object.keys(DEFAULT_PROFILES as Record<Role, unknown>), null, 2)}</pre>
      </details>
    </div>
  );
}
