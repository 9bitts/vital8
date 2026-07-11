"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuButton,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/core/actions/auth.actions";
import { switchOrganizationAction } from "@/modules/core/actions/organization.actions";

type OrganizationOption = {
  organizationId: string;
  organization: { id: string; name: string };
  role: string;
};

export function AppHeader({
  organizations,
  currentOrganizationName,
}: {
  organizations: OrganizationOption[];
  currentOrganizationName: string;
}) {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleSwitch(orgId: string) {
    startTransition(async () => {
      const result = await switchOrganizationAction({ organizationId: orgId });
      if (result.success && result.data) {
        await update({
          organizationId: result.data.organizationId,
          role: result.data.role,
        });
        router.refresh();
      }
    });
  }

  async function handleLogout() {
    await logoutAction();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <div className="flex items-center gap-4">
        {organizations.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <DropdownMenuButton disabled={isPending}>
                {currentOrganizationName}
              </DropdownMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {organizations.map((membership) => (
                <DropdownMenuItem
                  key={membership.organizationId}
                  onClick={() => handleSwitch(membership.organizationId)}
                  disabled={
                    membership.organizationId === session?.organizationId
                  }
                >
                  {membership.organization.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-sm font-medium">{currentOrganizationName}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-600">{session?.user?.name}</span>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Sair
        </Button>
      </div>
    </header>
  );
}
