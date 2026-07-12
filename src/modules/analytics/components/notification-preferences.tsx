"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  getNotificationPrefsAction,
  saveNotificationPrefsAction,
} from "@/modules/analytics/actions/analytics.actions";

export function NotificationPreferencesPanel() {
  const [inApp, setInApp] = useState(true);
  const [email, setEmail] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const prefs = await getNotificationPrefsAction();
      setInApp(prefs.inAppEnabled);
      setEmail(prefs.emailEnabled);
    });
  }, []);

  return (
    <div className="rounded border p-4 space-y-3 text-sm">
      <p className="font-medium">Preferências de notificação</p>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={inApp} onChange={(e) => setInApp(e.target.checked)} />
        In-app (sino)
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
        E-mail (dev: console)
      </label>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await saveNotificationPrefsAction({ inAppEnabled: inApp, emailEnabled: email });
            setSaved(true);
          })
        }
      >
        Salvar
      </Button>
      {saved && <p className="text-green-700 text-xs">Preferências salvas.</p>}
    </div>
  );
}
