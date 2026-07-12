"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  getNotificationPrefsAction,
  saveNotificationPrefsAction,
} from "@/modules/analytics/actions/analytics.actions";

const PUSH_CATEGORIES = [
  { key: "next_appointment", label: "Próxima consulta" },
  { key: "check_in", label: "Check-in do paciente" },
  { key: "lab_result", label: "Resultado de exame" },
  { key: "secretary_escalation", label: "Mensagem da secretária IA" },
] as const;

export function NotificationPreferencesPanel() {
  const [inApp, setInApp] = useState(true);
  const [email, setEmail] = useState(false);
  const [push, setPush] = useState(true);
  const [pushCats, setPushCats] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const prefs = await getNotificationPrefsAction();
      setInApp(prefs.inAppEnabled);
      setEmail(prefs.emailEnabled);
      setPush(prefs.pushEnabled ?? true);
      setPushCats((prefs.pushCategories as Record<string, boolean>) ?? {});
    });
  }, []);

  async function subscribePush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const reg = await navigator.serviceWorker.ready;
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) return;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapid,
    });
    const json = sub.toJSON();
    await fetch("/api/mobile/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        expirationTime: sub.expirationTime,
      }),
    });
  }

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
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />
        Push (PWA)
      </label>
      {push && (
        <div className="ml-4 space-y-1">
          {PUSH_CATEGORIES.map((c) => (
            <label key={c.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={pushCats[c.key] !== false}
                onChange={(e) =>
                  setPushCats((prev) => ({ ...prev, [c.key]: e.target.checked }))
                }
              />
              {c.label}
            </label>
          ))}
        </div>
      )}
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await saveNotificationPrefsAction({
              inAppEnabled: inApp,
              emailEnabled: email,
              pushEnabled: push,
              pushCategories: pushCats,
            });
            if (push) await subscribePush();
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
