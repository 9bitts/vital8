"use client";

import { useEffect, useState, useTransition } from "react";
import { formatBRL } from "@/lib/money";
import { listPackagesAction } from "@/modules/finance/actions/finance.actions";

export function PackagesPanel() {
  const [packages, setPackages] = useState<
    Awaited<ReturnType<typeof listPackagesAction>>
  >([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setPackages(await listPackagesAction());
    });
  }, []);

  return (
    <ul className="space-y-2">
      {packages.map((p) => (
        <li key={p.id} className="rounded border p-3 text-sm">
          <strong>{p.name}</strong> — {p.sessionCount} sessões —{" "}
          {formatBRL(p.priceCents)}
        </li>
      ))}
    </ul>
  );
}
