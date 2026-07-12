import { createHash } from "crypto";

/** MD5 do conteúdo XML antes do epílogo `<hash>` (padrão TISS ANS). */
export function computeTissBatchHash(xmlWithoutHash: string): string {
  return createHash("md5").update(xmlWithoutHash, "utf8").digest("hex");
}
