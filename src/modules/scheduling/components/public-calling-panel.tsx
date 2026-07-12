"use client";

import { useEffect, useState } from "react";

type PanelCall = {
  id: string;
  name: string;
  room: string;
  queueNumber: number | null;
  calledAt: string | null;
};

type PanelData = {
  orgName: string;
  calls: PanelCall[];
};

export function PublicCallingPanel({ orgSlug }: { orgSlug: string }) {
  const [data, setData] = useState<PanelData | null>(null);

  useEffect(() => {
    async function poll() {
      const res = await fetch(`/api/painel/${orgSlug}`);
      if (res.ok) {
        setData(await res.json());
      }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [orgSlug]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-900 text-white">
        Carregando painel…
      </div>
    );
  }

  const [latest, ...history] = data.calls;

  return (
    <div className="min-h-screen bg-zinc-900 p-8 text-white">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-light text-zinc-400">{data.orgName}</h1>
        <p className="text-sm text-zinc-500">Painel de chamada</p>
      </header>

      {latest ? (
        <div className="mx-auto max-w-3xl rounded-2xl bg-emerald-600 p-12 text-center shadow-2xl">
          <p className="text-lg uppercase tracking-widest text-emerald-100">
            Senha {latest.queueNumber ?? "—"}
          </p>
          <p className="mt-4 text-5xl font-bold">{latest.name}</p>
          <p className="mt-4 text-2xl text-emerald-100">{latest.room}</p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-700 p-12 text-center text-zinc-400">
          Aguardando próxima chamada…
        </div>
      )}

      {history.length > 0 && (
        <div className="mx-auto mt-12 max-w-xl">
          <h2 className="mb-4 text-sm uppercase tracking-wider text-zinc-500">
            Chamadas anteriores
          </h2>
          <ul className="space-y-2">
            {history.slice(0, 5).map((c) => (
              <li
                key={c.id}
                className="flex justify-between rounded bg-zinc-800 px-4 py-3 text-lg"
              >
                <span>
                  #{c.queueNumber} {c.name}
                </span>
                <span className="text-zinc-400">{c.room}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
