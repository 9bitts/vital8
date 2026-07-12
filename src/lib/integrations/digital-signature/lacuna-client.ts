import { z } from "zod";

const ENDPOINT = () =>
  (process.env.LACUNA_ENDPOINT || "https://core.pki.rest").replace(/\/+$/, "");

const API_KEY = () => process.env.LACUNA_API_KEY?.trim() || "";

const SECURITY_CONTEXT = () => process.env.LACUNA_SECURITY_CONTEXT?.trim() || "";

export function isLacunaConfigured(): boolean {
  return Boolean(API_KEY());
}

export interface CreateSessionResult {
  sessionId: string;
  redirectUrl: string;
}

export interface SignatureSessionDocument {
  id?: string;
  status?: string;
  signedFile?: { location?: string; name?: string } | null;
  originalFile?: { name?: string } | null;
}

export interface SignatureSession {
  id: string;
  status: string;
  documents: SignatureSessionDocument[];
}

const createSessionInputSchema = z.object({
  pdfBytes: z.instanceof(Buffer).or(z.instanceof(Uint8Array)),
  fileName: z.string().min(1).max(200),
  returnUrl: z.string().url(),
  cpf: z.string().optional().nullable(),
});

function assertConfig() {
  if (!API_KEY()) {
    throw new Error(
      "LACUNA_API_KEY não configurada. Defina a variável de ambiente.",
    );
  }
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${API_KEY()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function createSignatureSession(
  opts: z.infer<typeof createSessionInputSchema>,
): Promise<CreateSessionResult> {
  assertConfig();
  const parsed = createSessionInputSchema.parse(opts);
  const base64 = Buffer.from(parsed.pdfBytes).toString("base64");

  const body: Record<string, unknown> = {
    returnUrl: parsed.returnUrl,
    documents: [
      {
        file: { content: base64, name: parsed.fileName },
      },
    ],
  };

  if (SECURITY_CONTEXT()) {
    body.securityContextId = SECURITY_CONTEXT();
  }

  if (parsed.cpf) {
    const digits = parsed.cpf.replace(/\D/g, "");
    if (digits.length === 11) {
      body.certificateRequirements = [{ type: "Cpf", argument: digits }];
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT()}/api/signature-sessions`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    throw new Error(`Lacuna fetch falhou: ${(e as Error).message}`);
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Lacuna createSignatureSession falhou (${res.status}): ${text.slice(0, 500)}`,
    );
  }

  const data = (await res.json()) as {
    id?: string;
    sessionId?: string;
    redirectUrl?: string;
    redirectTo?: string;
  };

  const sessionId = data.id || data.sessionId || "";
  const redirectUrl = data.redirectUrl || data.redirectTo || "";

  if (!sessionId || !redirectUrl) {
    throw new Error(
      `Lacuna devolveu resposta inesperada: ${JSON.stringify(data).slice(0, 300)}`,
    );
  }

  return { sessionId, redirectUrl };
}

export async function getSignatureSession(
  sessionId: string,
): Promise<SignatureSession> {
  assertConfig();

  const res = await fetch(
    `${ENDPOINT()}/api/signature-sessions/${encodeURIComponent(sessionId)}`,
    { method: "GET", headers: authHeaders() },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Lacuna getSignatureSession falhou (${res.status}): ${text.slice(0, 500)}`,
    );
  }

  return (await res.json()) as SignatureSession;
}

export async function downloadSignedPdf(location: string): Promise<Buffer> {
  assertConfig();

  const url = location.startsWith("http")
    ? location
    : `${ENDPOINT()}${location.startsWith("/") ? "" : "/"}${location}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${API_KEY()}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Lacuna downloadSignedPdf falhou (${res.status}): ${text.slice(0, 300)}`,
    );
  }

  return Buffer.from(await res.arrayBuffer());
}

export function getSignedLocation(session: SignatureSession): string | null {
  const anySession = session as unknown as Record<string, unknown>;
  const docs =
    (anySession.documents as SignatureSessionDocument[] | undefined) ||
    (anySession.Documents as SignatureSessionDocument[] | undefined) ||
    [];
  const doc = docs[0];
  if (!doc) return null;

  const signedFile =
    doc.signedFile ||
    (doc as Record<string, unknown>).SignedFile ||
    null;
  if (!signedFile || typeof signedFile !== "object") return null;

  const sf = signedFile as Record<string, string | undefined>;
  return sf.location || sf.Location || sf.url || sf.Url || null;
}
