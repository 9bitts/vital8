"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { smartSearchAction, getNavItemsAction } from "@/modules/ai/actions/ai.actions";

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [navItems, setNavItems] = useState<{ route: string; label: string }[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    getNavItemsAction().then(setNavItems);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runSearch = useCallback(
    (q: string) => {
      startTransition(async () => {
        const r = await smartSearchAction(q);
        if (r.success && r.data?.route) {
          router.push(r.data.route);
          setOpen(false);
          setQuery("");
        }
      });
    },
    [router],
  );

  if (!open) {
    return (
      <button
        type="button"
        className="hidden md:flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50"
        onClick={() => setOpen(true)}
      >
        Buscar… <kbd className="text-xs bg-zinc-100 px-1 rounded">Ctrl+K</kbd>
      </button>
    );
  }

  const filtered = navItems.filter(
    (n) => !query || n.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-[15vh]">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg border p-2 space-y-2">
        <Input
          autoFocus
          placeholder="Buscar pacientes, telas ou linguagem natural…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) runSearch(query.trim());
          }}
        />
        <ul className="max-h-64 overflow-y-auto text-sm">
          {filtered.map((n) => (
            <li key={n.route}>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 hover:bg-zinc-100 rounded"
                onClick={() => {
                  router.push(n.route);
                  setOpen(false);
                }}
              >
                {n.label}
              </button>
            </li>
          ))}
          {query && (
            <li>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 hover:bg-violet-50 text-violet-800 rounded"
                disabled={pending}
                onClick={() => runSearch(query)}
              >
                Interpretar: &quot;{query}&quot;
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
