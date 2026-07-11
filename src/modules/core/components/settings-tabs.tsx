"use client";

import { useState, useTransition } from "react";
import type { Organization, Role } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  updateOrganizationAction,
  inviteMemberAction,
  updateMemberRoleAction,
  deactivateMemberAction,
  listAuditLogsAction,
} from "@/modules/core/actions/organization.actions";

type Member = {
  id: string;
  role: Role;
  isActive: boolean;
  user: { id: string; name: string; email: string };
};

type AuditItem = {
  id: string;
  action: string;
  createdAt: Date;
  user: { name: string; email: string } | null;
  metadata: unknown;
};

const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  PROFISSIONAL_SAUDE: "Profissional de saúde",
  RECEPCAO: "Recepção",
  FINANCEIRO: "Financeiro",
  LEITURA: "Somente leitura",
};

export function SettingsTabs({
  organization,
  members,
  canManage,
  initialAudit,
}: {
  organization: Organization;
  members: Member[];
  canManage: boolean;
  initialAudit: {
    items: AuditItem[];
    total: number;
    page: number;
    totalPages: number;
  };
}) {
  const [orgForm, setOrgForm] = useState({
    name: organization.name,
    type: organization.type,
    documentType: organization.documentType,
    documentNumber: organization.documentNumber,
    phone: organization.phone ?? "",
    email: organization.email ?? "",
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("RECEPCAO");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [audit, setAudit] = useState(initialAudit);
  const [isPending, startTransition] = useTransition();

  function saveOrganization() {
    startTransition(async () => {
      const result = await updateOrganizationAction(orgForm);
      setMessage(result.success ? "Organização atualizada" : result.error);
    });
  }

  function sendInvite() {
    startTransition(async () => {
      const result = await inviteMemberAction({
        email: inviteEmail,
        role: inviteRole,
      });
      if (result.success && result.data) {
        setInviteLink(`${window.location.origin}/convite/${result.data.token}`);
        setInviteEmail("");
        setMessage("Convite criado");
      } else if (!result.success) {
        setMessage(result.error);
      }
    });
  }

  function changeRole(membershipId: string, role: Role) {
    startTransition(async () => {
      const result = await updateMemberRoleAction({ membershipId, role });
      setMessage(result.success ? "Papel atualizado" : result.error ?? "Erro");
    });
  }

  function deactivate(membershipId: string) {
    startTransition(async () => {
      const result = await deactivateMemberAction({ membershipId });
      setMessage(result.success ? "Membro desativado" : result.error ?? "Erro");
    });
  }

  function loadAuditPage(page: number) {
    startTransition(async () => {
      const data = await listAuditLogsAction(page);
      setAudit(data);
    });
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm">{message}</p>
      )}
      <Tabs defaultValue="org">
        <TabsList>
          <TabsTrigger value="org">Organização</TabsTrigger>
          {canManage && <TabsTrigger value="members">Membros</TabsTrigger>}
          {canManage && <TabsTrigger value="audit">Auditoria</TabsTrigger>}
        </TabsList>

        <TabsContent value="org" className="space-y-4 pt-4">
          <div className="grid gap-4 max-w-xl">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={orgForm.name}
                disabled={!canManage}
                onChange={(e) =>
                  setOrgForm({ ...orgForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={orgForm.type}
                disabled={!canManage}
                onValueChange={(v) =>
                  setOrgForm({ ...orgForm, type: v as Organization["type"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLINICA">Clínica</SelectItem>
                  <SelectItem value="CONSULTORIO">Consultório</SelectItem>
                  <SelectItem value="PROFISSIONAL_AUTONOMO">
                    Profissional autônomo
                  </SelectItem>
                  <SelectItem value="ASSOCIACAO">Associação</SelectItem>
                  <SelectItem value="LABORATORIO">Laboratório</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canManage && (
              <Button onClick={saveOrganization} disabled={isPending}>
                Salvar alterações
              </Button>
            )}
          </div>
        </TabsContent>

        {canManage && (
          <TabsContent value="members" className="space-y-6 pt-4">
            <div className="rounded-lg border border-zinc-200 p-4 space-y-3 max-w-xl">
              <h3 className="font-medium">Convidar membro</h3>
              <div className="grid gap-3">
                <Input
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as Role)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      [
                        "ADMIN",
                        "PROFISSIONAL_SAUDE",
                        "RECEPCAO",
                        "FINANCEIRO",
                        "LEITURA",
                      ] as Role[]
                    ).map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={sendInvite} disabled={isPending}>
                  Enviar convite
                </Button>
                {inviteLink && (
                  <p className="text-xs break-all text-zinc-600">
                    Link do convite: {inviteLink}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-4"
                >
                  <div>
                    <p className="font-medium">{member.user.name}</p>
                    <p className="text-sm text-zinc-500">{member.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.role === "OWNER" ? (
                      <Badge>{ROLE_LABELS[member.role]}</Badge>
                    ) : (
                      <>
                        <Select
                          value={member.role}
                          onValueChange={(v) =>
                            changeRole(member.id, v as Role)
                          }
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              [
                                "ADMIN",
                                "PROFISSIONAL_SAUDE",
                                "RECEPCAO",
                                "FINANCEIRO",
                                "LEITURA",
                              ] as Role[]
                            ).map((role) => (
                              <SelectItem key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deactivate(member.id)}
                        >
                          Desativar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="audit" className="pt-4">
            <div className="space-y-2">
              {audit.items.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{log.action}</p>
                    <p className="text-zinc-500">
                      {log.user?.name ?? "Sistema"} ·{" "}
                      {new Date(log.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={audit.page <= 1 || isPending}
                onClick={() => loadAuditPage(audit.page - 1)}
              >
                Anterior
              </Button>
              <span className="flex items-center text-sm text-zinc-500">
                Página {audit.page} de {audit.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={audit.page >= audit.totalPages || isPending}
                onClick={() => loadAuditPage(audit.page + 1)}
              >
                Próxima
              </Button>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
