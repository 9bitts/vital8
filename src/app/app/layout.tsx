import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { adminPrisma } from "@/lib/db/admin-client";
import { AppSidebar } from "@/modules/core/components/app-sidebar";
import { AppHeader } from "@/modules/core/components/app-header";
import { listUserOrganizationsAction } from "@/modules/core/actions/organization.actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) {
    redirect("/entrar");
  }

  const memberships = await listUserOrganizationsAction();
  const currentOrg = await adminPrisma.organization.findFirst({
    where: { id: session.organizationId, deletedAt: null },
  });

  if (!currentOrg) {
    redirect("/entrar");
  }

  return (
    <div className="flex h-screen bg-white">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader
          organizations={memberships.map((m) => ({
            organizationId: m.organizationId,
            organization: m.organization,
            role: m.role,
          }))}
          currentOrganizationName={currentOrg.name}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
