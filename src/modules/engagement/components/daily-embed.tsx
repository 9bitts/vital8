"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { DailyCall } from "@daily-co/daily-js";

export type DailyEmbedHandle = {
  leave: () => Promise<void>;
};

type Props = {
  url: string;
  token: string;
  className?: string;
  onError?: (message: string) => void;
};

async function destroyCallSafely(call: DailyCall | null): Promise<void> {
  if (!call) return;
  try {
    const stateFn = (call as DailyCall & { meetingState?: () => string })
      .meetingState;
    const state = typeof stateFn === "function" ? stateFn() : "";
    if (state === "joined-meeting") {
      try {
        await call.leave();
      } catch {
        /* already left */
      }
    }
  } catch {
    /* ignore */
  }
  try {
    await call.destroy();
  } catch {
    /* already destroyed */
  }
}

export const DailyEmbed = forwardRef<DailyEmbedHandle, Props>(
  function DailyEmbed(
    { url, token, className = "h-[420px] w-full min-h-[280px]", onError },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const callRef = useRef<DailyCall | null>(null);
    const onErrorRef = useRef(onError);
    const [joining, setJoining] = useState(true);
    const [needsReconnect, setNeedsReconnect] = useState(false);
    const [reconnectKey, setReconnectKey] = useState(0);

    useEffect(() => {
      onErrorRef.current = onError;
    }, [onError]);

    const triggerReconnect = useCallback(() => {
      setNeedsReconnect(false);
      setJoining(true);
      setReconnectKey((k) => k + 1);
    }, []);

    useImperativeHandle(ref, () => ({
      leave: async () => {
        const call = callRef.current;
        callRef.current = null;
        await destroyCallSafely(call);
      },
    }));

    useEffect(() => {
      if (!url?.trim() || !token?.trim()) {
        setJoining(false);
        return;
      }

      let cancelled = false;

      async function mount() {
        if (!containerRef.current || cancelled) return;
        setJoining(true);
        setNeedsReconnect(false);

        try {
          if (callRef.current) {
            const prev = callRef.current;
            callRef.current = null;
            await destroyCallSafely(prev);
          }
          if (cancelled || !containerRef.current) return;

          const DailyIframe = (await import("@daily-co/daily-js")).default;
          const existing = DailyIframe.getCallInstance?.();
          if (existing) {
            await destroyCallSafely(existing);
          }
          if (cancelled || !containerRef.current) return;

          const call = DailyIframe.createFrame(containerRef.current, {
            showLeaveButton: true,
            iframeStyle: {
              width: "100%",
              height: "100%",
              border: "0",
              borderRadius: "8px",
            },
          });
          callRef.current = call;

          call.on("joined-meeting", () => {
            if (!cancelled) setJoining(false);
          });
          call.on("error", (ev) => {
            if (!cancelled) {
              setJoining(false);
              setNeedsReconnect(true);
              onErrorRef.current?.(
                (ev as { errorMsg?: string }).errorMsg ||
                  "Erro na chamada de vídeo",
              );
            }
          });
          call.on("left-meeting", () => {
            if (!cancelled) {
              setJoining(false);
              setNeedsReconnect(true);
            }
          });

          await call.join({ url, token });
        } catch (e) {
          if (!cancelled) {
            setJoining(false);
            setNeedsReconnect(true);
            onErrorRef.current?.(
              e instanceof Error ? e.message : "Falha ao entrar na sala",
            );
          }
        }
      }

      void mount();

      return () => {
        cancelled = true;
        const call = callRef.current;
        callRef.current = null;
        void destroyCallSafely(call);
      };
    }, [url, token, reconnectKey]);

    return (
      <div className="relative rounded-lg border bg-zinc-950">
        {joining && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/80 text-sm text-zinc-200">
            Conectando à sala…
          </div>
        )}
        {needsReconnect && !joining && (
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 bg-amber-100 px-3 py-2 text-sm text-amber-900">
            <span>Conexão interrompida</span>
            <button
              type="button"
              className="underline"
              onClick={triggerReconnect}
            >
              Reconectar
            </button>
          </div>
        )}
        <div ref={containerRef} className={className} />
      </div>
    );
  },
);
