"use client";

import { signIn } from "next-auth/react";
import {
  DOCTOR8_CNPJ_LOGINS,
} from "@/modules/core/components/doctor8-login-ctas";

function signInWithDoctor8() {
  void signIn("doctor8", { callbackUrl: "/app" });
}

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#050505] text-white">
      {/* Gradiente de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(120,120,140,0.25),transparent_60%),radial-gradient(ellipse_60%_50%_at_80%_110%,rgba(60,60,80,0.35),transparent_60%),linear-gradient(180deg,#0a0a0c_0%,#050505_45%,#0c0c10_100%)]"
      />

      {/* Grid sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]"
      />

      {/* Símbolo do infinito */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <svg
          viewBox="0 0 500 260"
          className="w-[min(90vw,900px)] opacity-70"
          fill="none"
        >
          <defs>
            <linearGradient id="inf-grad" x1="0" y1="0" x2="500" y2="260" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="35%" stopColor="#9ca3af" stopOpacity="0.5" />
              <stop offset="70%" stopColor="#52525b" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.8" />
            </linearGradient>
            <filter id="inf-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="10" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M130 130 C130 62 250 62 250 130 C250 198 370 198 370 130 C370 62 250 62 250 130 C250 198 130 198 130 130 Z"
            stroke="url(#inf-grad)"
            strokeWidth="2.5"
            filter="url(#inf-glow)"
            strokeLinecap="round"
            className="animate-pulse [animation-duration:5s]"
          />
          <path
            d="M130 130 C130 62 250 62 250 130 C250 198 370 198 370 130 C370 62 250 62 250 130 C250 198 130 198 130 130 Z"
            stroke="url(#inf-grad)"
            strokeWidth="1"
            strokeOpacity="0.6"
          />
        </svg>
      </div>

      {/* Conteúdo */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="mb-12 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-widest text-zinc-400 uppercase backdrop-blur">
            Vital8 · Ecossistema Doctor8
          </div>
          <h1 className="bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-6xl">
            Vital8
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-zinc-400 sm:text-base">
            Escolha o tipo de conta para entrar com seu login Doctor8.
          </p>
        </div>

        <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
          {DOCTOR8_CNPJ_LOGINS.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={signInWithDoctor8}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08] hover:shadow-[0_0_40px_rgba(255,255,255,0.08)]"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.02] transition-colors group-hover:border-white/20">
                  <Icon className="h-5 w-5 text-zinc-300 transition-colors group-hover:text-white" aria-hidden />
                </div>
                <div className="text-base font-semibold text-white">
                  {entry.label}
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  {entry.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors group-hover:text-zinc-300">
                  Entrar com Doctor8
                  <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </main>

      <footer className="relative z-10 pb-8 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} Vital8 — Gestão completa para quem cuida de vidas
      </footer>
    </div>
  );
}
