"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { initOfflineStore, purgeOfflineStore } from "@/lib/offline/store.client";
import { syncWhenOnline } from "@/lib/offline/sync.client";
import { PwaInstallBanner } from "./pwa-install-banner";
import { OfflineBanner } from "./offline-banner";

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [online, setOnline] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    const role = session.role as string | undefined;
    if (role === "FINANCEIRO") return;

    async function bootstrap() {
      try {
        const res = await fetch("/api/mobile/cache-key");
        if (!res.ok) return;
        const json = await res.json();
        await initOfflineStore(json.data.keyMaterial);
        if (navigator.onLine) {
          const result = await syncWhenOnline();
          setLastSync(result.snapshotAt);
        }
      } catch {
        /* offline bootstrap falha silenciosamente */
      }
    }
    void bootstrap();
  }, [status, session?.user?.id, session?.role]);

  useEffect(() => {
    if (!online || status !== "authenticated") return;
    void syncWhenOnline().then((r) => setLastSync(r.snapshotAt));
  }, [online, status]);

  useEffect(() => {
    if (status === "unauthenticated") {
      void purgeOfflineStore();
    }
  }, [status]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return (
    <>
      <OfflineBanner online={online} lastSync={lastSync} />
      <PwaInstallBanner />
      {children}
    </>
  );
}
