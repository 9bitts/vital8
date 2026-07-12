"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  unreadCountAction,
} from "../actions/analytics.actions";
import { NotificationPreferencesPanel } from "./notification-preferences";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof listNotificationsAction>>
  >([]);
  const [pending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      setCount(await unreadCountAction());
      setItems(await listNotificationsAction());
    });

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => {
          setOpen(!open);
          load();
        }}
        aria-label={`Notificações${count ? `, ${count} não lidas` : ""}`}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-md border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">Notificações</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsReadAction();
                  load();
                })
              }
            >
              Marcar todas
            </Button>
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-3 py-4 text-sm text-zinc-500">Nenhuma notificação.</li>
            )}
            {items.map((n) => (
              <li
                key={n.id}
                className={`border-b px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50 ${n.readAt ? "opacity-60" : ""}`}
                onClick={() =>
                  startTransition(async () => {
                    if (!n.readAt) await markNotificationReadAction(n.id);
                    load();
                  })
                }
              >
                <p className="font-medium">{n.title}</p>
                <p className="text-zinc-600">{n.body}</p>
              </li>
            ))}
          </ul>
          <NotificationPreferencesPanel />
        </div>
      )}
    </div>
  );
}
