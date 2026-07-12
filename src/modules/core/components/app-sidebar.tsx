"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  FileText,
  Home,
  Package,
  Settings,
  Stethoscope,
  Users,
  Wallet,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/app", label: "Início", icon: Home, active: true },
  {
    href: "/app/agenda",
    label: "Agenda",
    icon: Calendar,
    active: false,
    badge: "Em breve",
  },
  {
    href: "/app/pacientes",
    label: "Pacientes",
    icon: Users,
    active: true,
  },
  {
    href: "/app/prontuario",
    label: "Prontuário",
    icon: Stethoscope,
    active: false,
    badge: "Em breve",
  },
  {
    href: "/app/financeiro",
    label: "Financeiro",
    icon: Wallet,
    active: false,
    badge: "Em breve",
  },
  {
    href: "/app/estoque",
    label: "Estoque",
    icon: Package,
    active: false,
    badge: "Em breve",
  },
  {
    href: "/app/relatorios",
    label: "Relatórios",
    icon: BarChart3,
    active: false,
    badge: "Em breve",
  },
  {
    href: "/app/configuracoes",
    label: "Configurações",
    icon: Settings,
    active: true,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="flex h-14 items-center border-b border-zinc-200 px-4">
        <Link href="/app" className="flex items-center gap-2 font-semibold">
          <FileText className="h-5 w-5" />
          Vital8
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);

          if (!item.active) {
            return (
              <div
                key={item.href}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-400 cursor-not-allowed"
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {item.badge && (
                  <Badge variant="warning" className="text-[10px]">
                    {item.badge}
                  </Badge>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-600 hover:bg-white/60 hover:text-zinc-900",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
