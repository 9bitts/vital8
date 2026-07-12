type Data = Awaited<
  ReturnType<
    typeof import("../services/dashboard.service").getReceptionTodayDashboard
  >
>;

type Props = { data: Data };

export function ReceptionDashboard({ data }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded border p-4">
          <p className="text-sm text-zinc-600">Confirmações pendentes</p>
          <p className="text-2xl font-semibold">{data.pendingConfirmations}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-zinc-600">Online a aprovar</p>
          <p className="text-2xl font-semibold">{data.onlinePending}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-zinc-600">Na fila hoje</p>
          <p className="text-2xl font-semibold">{data.queue.length}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-zinc-600">Aniversariantes</p>
          <p className="text-2xl font-semibold">{data.todayBirthdays?.length ?? 0}</p>
        </div>
      </div>
      {(data.todayBirthdays?.length ?? 0) > 0 && (
        <div>
          <h2 className="font-medium mb-2">Aniversariantes do dia</h2>
          <ul className="space-y-1 text-sm">
            {data.todayBirthdays!.map((p) => (
              <li key={p.id}>{p.fullName}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h2 className="font-medium mb-2">Fila do dia</h2>
        <ul className="space-y-2 text-sm">
          {data.queue.map((a) => (
            <li key={a.id} className="rounded border p-2 flex justify-between">
              <span>
                {a.patient.fullName} — {a.professional.displayName}
              </span>
              <span className="text-zinc-500">
                {a.startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </li>
          ))}
          {data.queue.length === 0 && <li className="text-zinc-500">Fila vazia.</li>}
        </ul>
      </div>
    </div>
  );
}
