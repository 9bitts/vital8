import { requireAuth } from "@/lib/auth/guards";

export default async function RelatoriosAgendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth(["OWNER", "ADMIN", "RECEPCAO", "PROFISSIONAL_SAUDE"]);
  return children;
}
