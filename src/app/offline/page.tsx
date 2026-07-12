import Link from "next/link";

export default function OfflineFallbackPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Você está offline</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Abra o Vital8 Mobile para ver a agenda em cache ou aguarde a conexão.
      </p>
      <Link
        href="/m/hoje"
        className="min-h-11 rounded-md bg-blue-600 px-6 py-3 text-white"
      >
        Ir para Hoje
      </Link>
    </div>
  );
}
