"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const VISIT_KEY = "vital8-pwa-visits";
const DISMISS_KEY = "vital8-pwa-dismissed";

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const visits = Number(localStorage.getItem(VISIT_KEY) ?? "0") + 1;
    localStorage.setItem(VISIT_KEY, String(visits));
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (visits >= 2 && !dismissed) setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !deferred) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-lg dark:border-blue-800 dark:bg-blue-950">
      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
        Instale o Vital8 no seu dispositivo para acesso rápido à agenda.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="min-h-11 flex-1 rounded-md bg-blue-600 px-4 text-sm font-medium text-white"
          onClick={async () => {
            await deferred.prompt();
            setVisible(false);
          }}
        >
          Instalar
        </button>
        <button
          type="button"
          className="min-h-11 rounded-md px-4 text-sm text-blue-700 dark:text-blue-200"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
