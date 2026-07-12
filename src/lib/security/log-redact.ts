const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\b\d{10,13}\b/g;

function shouldRedactLogs(): boolean {
  return process.env.NODE_ENV !== "development";
}

export function redactForLog(value: string): string {
  if (!shouldRedactLogs()) return value;
  return value
    .replace(EMAIL_PATTERN, "[email]")
    .replace(PHONE_PATTERN, "[phone]");
}

export function safeLog(tag: string, message: string): void {
  if (process.env.NODE_ENV === "test") return;
  console.log(`[${tag}] ${redactForLog(message)}`);
}
