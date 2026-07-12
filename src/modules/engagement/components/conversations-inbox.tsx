"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  assignConversationAction,
  getConversationMessagesAction,
  listConversationsAction,
  replyConversationAction,
  suggestAiReplyAction,
} from "@/modules/engagement/actions/conversation.actions";

type Thread = Awaited<ReturnType<typeof listConversationsAction>>[number];
type Message = Awaited<ReturnType<typeof getConversationMessagesAction>>[number];

export function ConversationsInbox({
  initialThreads,
}: {
  initialThreads: Thread[];
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialThreads[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();

  function loadMessages(threadId: string) {
    startTransition(async () => {
      setSelectedId(threadId);
      setMessages(await getConversationMessagesAction(threadId));
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ul className="space-y-2 rounded border p-2 text-sm max-h-[70vh] overflow-y-auto">
        {threads.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className={`w-full rounded p-2 text-left hover:bg-zinc-50 ${
                selectedId === t.id ? "bg-zinc-100" : ""
              }`}
              onClick={() => loadMessages(t.id)}
            >
              <div className="font-medium">
                {t.patient?.socialName ?? t.patient?.fullName ?? t.phone}
              </div>
              <div className="text-xs text-zinc-500">
                {t.status} · {t.lastMessageAt.toLocaleString("pt-BR")}
              </div>
              {t.messages[0] && (
                <p className="truncate text-xs text-zinc-600">{t.messages[0].body}</p>
              )}
            </button>
          </li>
        ))}
        {threads.length === 0 && (
          <li className="text-zinc-500 p-2">Nenhuma conversa ainda.</li>
        )}
      </ul>

      <div className="lg:col-span-2 rounded border p-4 space-y-3">
        {!selectedId ? (
          <p className="text-sm text-zinc-500">Selecione uma conversa.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await assignConversationAction(selectedId);
                    setThreads(await listConversationsAction());
                  })
                }
              >
                Assumir conversa
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const suggestion = await suggestAiReplyAction(selectedId);
                    setReply(suggestion);
                  })
                }
              >
                Sugestão IA
              </Button>
            </div>

            <ul className="max-h-[50vh] space-y-2 overflow-y-auto text-sm">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`rounded p-2 ${
                    m.direction === "INBOUND"
                      ? "bg-blue-50 mr-8"
                      : "bg-zinc-100 ml-8"
                  }`}
                >
                  <span className="text-xs text-zinc-500">
                    {m.direction === "INBOUND" ? "Paciente" : "Clínica"} ·{" "}
                    {m.createdAt.toLocaleString("pt-BR")}
                  </span>
                  <p>{m.body}</p>
                </li>
              ))}
            </ul>

            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!reply.trim()) return;
                startTransition(async () => {
                  await replyConversationAction(selectedId, reply);
                  setReply("");
                  setMessages(await getConversationMessagesAction(selectedId));
                  setThreads(await listConversationsAction());
                });
              }}
            >
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Responder via WhatsApp…"
                rows={3}
              />
              <Button type="submit" size="sm" disabled={pending || !reply.trim()}>
                Enviar
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
