import { listNotificationsAction } from "@/modules/analytics/actions/analytics.actions";

export default async function MobileNotificacoesPage() {
  const notifications = await listNotificationsAction();

  return (
    <div className="space-y-3">
      <h2 className="font-medium">Notificações</h2>
      <ul className="space-y-2">
        {(notifications ?? []).map((n) => (
          <li
            key={n.id}
            className="rounded-lg border px-4 py-3 dark:border-zinc-800"
          >
            <p className="font-medium text-sm">{n.title}</p>
            <p className="text-sm text-zinc-500">{n.body}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {new Date(n.createdAt).toLocaleString("pt-BR")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
