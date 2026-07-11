import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const encoded = process.env.PHI_ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error("PHI_ENCRYPTION_KEY não configurada");
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `PHI_ENCRYPTION_KEY deve ter ${KEY_LENGTH} bytes (base64 de 32 bytes)`,
    );
  }

  return key;
}

export function encryptPHI(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptPHI(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Formato de ciphertext inválido");
  }

  const [ivB64, authTagB64, encryptedB64] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
