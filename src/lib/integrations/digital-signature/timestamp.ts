import { createHash } from "crypto";

/** Carimbo de tempo ACT/ITI — mock em dev; plugável para TSA real. */
export async function requestActTimestamp(contentHash: string): Promise<string | null> {
  const tsaUrl = process.env.ACT_TSA_URL;
  if (tsaUrl) {
    try {
      const res = await fetch(tsaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: contentHash, algorithm: "SHA-256" }),
      });
      if (res.ok) {
        const data = (await res.json()) as { token?: string };
        return data.token ?? null;
      }
    } catch {
      return null;
    }
  }

  const ts = new Date().toISOString();
  const token = createHash("sha256")
    .update(`ACT-MOCK:${contentHash}:${ts}`)
    .digest("hex");
  return `ACT:${token}:${ts}`;
}
