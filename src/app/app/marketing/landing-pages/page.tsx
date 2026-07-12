import { requireAuth } from "@/lib/auth/guards";
import { listLandingPagesAction } from "@/modules/marketing/actions/marketing.actions";
import Link from "next/link";
import { adminPrisma } from "@/lib/db/admin-client";

export default async function LandingPagesAdminPage() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  const pages = await listLandingPagesAction();
  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: ctx.organizationId },
    select: { slug: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Landing pages</h1>
      <ul className="space-y-2">
        {pages.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded border p-3">
            <div>
              <p className="font-medium">{p.title}</p>
              <p className="text-sm text-zinc-500">/{p.slug}</p>
            </div>
            <div className="flex gap-2 text-sm">
              <span>{p.published ? "Publicada" : "Rascunho"}</span>
              {p.published && (
                <Link
                  href={`/lp/${org.slug}/${p.slug}`}
                  className="text-blue-600"
                  target="_blank"
                >
                  Ver
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
