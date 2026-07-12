"use client";

import { useState, useTransition } from "react";
import { capturePublicLeadAction } from "@/modules/marketing/actions/public-lead.actions";

export function PublicLeadForm({
  orgSlug,
  consentText,
  utm,
}: {
  orgSlug: string;
  consentText: string;
  utm: Record<string, string | undefined>;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await capturePublicLeadAction({
            orgSlug,
            fullName,
            phone,
            email: email || undefined,
            marketingConsent: consent,
            privacyPolicyAccepted: privacy,
            honeypot: "",
            ...utm,
          });
          setMsg(res.success ? "Obrigado! Entraremos em contato." : res.error);
        });
      }}
    >
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />
      <input
        required
        placeholder="Nome completo"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="w-full rounded border px-3 py-2"
      />
      <input
        required
        placeholder="Telefone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded border px-3 py-2"
      />
      <input
        placeholder="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded border px-3 py-2"
      />
      <label className="flex gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        {consentText}
      </label>
      <label className="flex gap-2 text-sm">
        <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
        Li e aceito a política de privacidade
      </label>
      <button
        type="submit"
        disabled={pending || !consent || !privacy}
        className="min-h-11 w-full rounded bg-blue-600 px-4 text-white disabled:opacity-50"
      >
        Enviar
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}
