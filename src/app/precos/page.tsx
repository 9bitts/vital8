import Link from "next/link";
import { PLAN_PRICING_CENTS } from "@/lib/features/subscription-plans";
import { formatBRL } from "@/lib/money";

const PLANS = [
  {
    key: "BASICO",
    name: "Básico",
    features: ["Pacientes", "Agenda", "Prontuário", "Financeiro", "1 unidade"],
  },
  {
    key: "PRO",
    name: "Pro",
    features: ["Tudo do Básico", "TISS", "Estoque", "BI", "Portal", "Até 3 unidades"],
  },
  {
    key: "ENTERPRISE",
    name: "Enterprise",
    features: ["Tudo do Pro", "Telemedicina", "Unidades ilimitadas", "Suporte prioritário"],
  },
] as const;

export default function PrecosPage() {
  return (
    <div className="min-h-screen bg-zinc-50 py-16 px-4">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold text-center mb-2">Vital8 — Planos</h1>
        <p className="text-center text-zinc-600 mb-10">14 dias de trial · Sem cartão para começar</p>
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => {
            const price = PLAN_PRICING_CENTS[p.key];
            return (
              <div key={p.key} className="rounded-lg border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold">{p.name}</h2>
                <p className="mt-2 text-2xl font-bold">{formatBRL(price.monthly)}<span className="text-sm font-normal text-zinc-500">/mês</span></p>
                <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                  {p.features.map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
                <Link
                  href="/cadastro"
                  className="mt-6 block rounded-md bg-blue-600 px-4 py-2 text-center text-sm text-white hover:bg-blue-700"
                >
                  Começar trial
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
