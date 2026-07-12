"use client";

export function OfflineBanner({
  online,
  lastSync,
}: {
  online: boolean;
  lastSync: string | null;
}) {
  if (online && !lastSync) return null;

  return (
    <div
      className={`px-4 py-2 text-center text-sm ${
        online
          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
      }`}
      role="status"
    >
      {online ? (
        <span>
          Online
          {lastSync
            ? ` · Última sincronização ${new Date(lastSync).toLocaleString("pt-BR")}`
            : ""}
        </span>
      ) : (
        <span>Modo offline — leitura e ações serão sincronizadas ao reconectar</span>
      )}
    </div>
  );
}
