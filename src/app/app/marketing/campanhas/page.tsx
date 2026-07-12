import { requireAuth } from "@/lib/auth/guards";

export default async function CampanhasPage() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  const campaigns = await ctx.db.marketingCampaign.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { periodStart: "desc" },
    include: { leadSource: { select: { name: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Campanhas</h1>
      <ul className="space-y-2">
        {campaigns.map((c) => (
          <li key={c.id} className="rounded border p-3 text-sm">
            <p className="font-medium">{c.name}</p>
            <p>
              {c.channel} · {c.leadSource?.name ?? "—"} · invest. R${" "}
              {(c.investmentCents / 100).toFixed(2)}
            </p>
            <p className="text-xs text-zinc-500">
              UTM: {c.utmSource}/{c.utmMedium}/{c.utmCampaign}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
