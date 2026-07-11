import { notFound } from "next/navigation";
import { adminPrisma } from "@/lib/db/admin-client";
import { AcceptInviteForm } from "@/modules/core/components/accept-invite-form";

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await adminPrisma.invitation.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  });

  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.expiresAt < new Date()
  ) {
    notFound();
  }

  const existingUser = await adminPrisma.user.findFirst({
    where: { email: invitation.email.toLowerCase(), deletedAt: null },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <AcceptInviteForm
        token={token}
        email={invitation.email}
        organizationName={invitation.organization.name}
        isNewUser={!existingUser}
      />
    </div>
  );
}
