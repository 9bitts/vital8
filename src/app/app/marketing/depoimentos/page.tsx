import { listTestimonialsAction } from "@/modules/marketing/actions/marketing.actions";

export default async function DepoimentosPage() {
  const items = await listTestimonialsAction();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Depoimentos</h1>
      <ul className="space-y-2">
        {items.map((t) => (
          <li key={t.id} className="rounded border p-3 text-sm">
            <p className="font-medium">{t.authorName}</p>
            <p className="text-zinc-600">{t.content || "(aguardando)"}</p>
            <p className="text-xs text-zinc-500">
              {t.status}
              {t.consentAt ? ` · consentimento ${new Date(t.consentAt).toLocaleDateString("pt-BR")}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
