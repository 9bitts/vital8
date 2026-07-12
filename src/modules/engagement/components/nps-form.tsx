"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitNpsAction } from "@/modules/engagement/actions/portal.actions";

type Props = { token: string };

export function NpsForm({ token }: Props) {
  const [score, setScore] = useState(10);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return <p className="text-center text-green-700">Obrigado pela sua avaliação!</p>;
  }

  return (
    <form
      className="mx-auto max-w-md space-y-4 rounded border p-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await submitNpsAction(token, score, comment || undefined);
          setDone(true);
        });
      }}
    >
      <h1 className="text-lg font-semibold">Como foi seu atendimento?</h1>
      <p className="text-sm text-zinc-600">Nota de 0 a 10</p>
      <Input
        type="number"
        min={0}
        max={10}
        value={score}
        onChange={(e) => setScore(Number(e.target.value))}
      />
      <Input
        placeholder="Comentário (opcional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button type="submit" disabled={pending}>Enviar</Button>
    </form>
  );
}
