"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, CalendarDays, Bell, User, Users } from "lucide-react";

const NAV = [
  { href: "/m/hoje", label: "Hoje", icon: Calendar },
  { href: "/m/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/m/pacientes", label: "Pacientes", icon: Users },
  { href: "/m/notificacoes", label: "Notificações", icon: Bell },
  { href: "/m/perfil", label: "Perfil", icon: User },
] as const;

export function MobileBottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  const items =
    role === "RECEPCAO"
      ? NAV.filter((n) => ["Hoje", "Agenda", "Notificações", "Perfil"].includes(n.label))
      : NAV;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 pb-[env(safe-area-inset-bottom)]">
      <ul className="flex justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs ${
                  active
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
