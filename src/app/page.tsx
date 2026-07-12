"use client";

import { Space_Grotesk } from "next/font/google";
import {
  DOCTOR8_CNPJ_LOGINS,
  openDoctor8Login,
} from "@/modules/core/components/doctor8-login-ctas";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const INFINITY_PATH =
  "M130 130 C130 62 250 62 250 130 C250 198 370 198 370 130 C370 62 250 62 250 130 C250 198 130 198 130 130 Z";

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#050505] text-white">
      <style>{`
        @keyframes inf-flow {
          to { stroke-dashoffset: -1200; }
        }
        @keyframes inf-flow-rev {
          to { stroke-dashoffset: 1200; }
        }
        @keyframes inf-breathe {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Gradiente de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(120,120,150,0.28),transparent_60%),radial-gradient(ellipse_60%_50%_at_85%_110%,rgba(70,70,110,0.35),transparent_60%),radial-gradient(ellipse_50%_40%_at_10%_100%,rgba(50,60,90,0.25),transparent_60%),linear-gradient(180deg,#0a0a0e_0%,#050505_45%,#0b0b12_100%)]"
      />

      {/* Grid sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_45%,black,transparent)]"
      />

      {/* Símbolo do infinito — tela inteira */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <svg
          viewBox="0 0 500 260"
          preserveAspectRatio="xMidYMid slice"
          className="h-full w-full scale-110"
        >
          <defs>
            <linearGradient id="inf-grad" x1="0" y1="0" x2="500" y2="260" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="30%" stopColor="#a5b4fc" stopOpacity="0.55" />
              <stop offset="55%" stopColor="#71717a" stopOpacity="0.35" />
              <stop offset="80%" stopColor="#93c5fd" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="inf-grad-2" x1="500" y1="260" x2="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#818cf8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6" />
            </linearGradient>
            <filter id="inf-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="inf-glow-wide" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
          </defs>

          {/* Halo difuso ao fundo */}
          <path
            d={INFINITY_PATH}
            stroke="url(#inf-grad)"
            strokeWidth="14"
            fill="none"
            filter="url(#inf-glow-wide)"
            opacity="0.35"
          />

          {/* Traço principal com glow e respiração */}
          <path
            d={INFINITY_PATH}
            stroke="url(#inf-grad)"
            strokeWidth="2.5"
            fill="none"
            filter="url(#inf-glow)"
            strokeLinecap="round"
            style={{ animation: "inf-breathe 6s ease-in-out infinite" }}
          />

          {/* Fluxo de energia — tracejado animado */}
          <path
            d={INFINITY_PATH}
            stroke="url(#inf-grad)"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="40 560"
            style={{ animation: "inf-flow 7s linear infinite" }}
            filter="url(#inf-glow)"
          />
          <path
            d={INFINITY_PATH}
            stroke="url(#inf-grad-2)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="18 582"
            style={{ animation: "inf-flow-rev 9s linear infinite" }}
          />

          {/* Contorno fino estático */}
          <path
            d={INFINITY_PATH}
            stroke="url(#inf-grad-2)"
            strokeWidth="0.75"
            fill="none"
            strokeOpacity="0.5"
          />
        </svg>
      </div>

      {/* Conteúdo */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="mb-12 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-widest text-zinc-400 uppercase backdrop-blur">
            Vital8Erp · Gestão completa para quem cuida de vidas
          </div>
          <h1
            className={`${spaceGrotesk.className} bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-7xl`}
          >
            Vital8Erp
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
                onClick={() => openDoctor8Login(entry)}
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
        © {new Date().getFullYear()} Vital8Erp — Gestão completa para quem cuida de vidas
      </footer>
    </div>
  );
}
