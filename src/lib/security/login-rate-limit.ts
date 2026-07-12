import { checkRateLimit } from "@/modules/engagement/lib/rate-limit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function checkLoginRateLimit(email: string, ip: string): { allowed: boolean; retryAfterMs?: number } {
  const emailKey = `login:email:${email.toLowerCase()}`;
  const ipKey = `login:ip:${ip}`;
  const byEmail = checkRateLimit(emailKey, MAX_ATTEMPTS, WINDOW_MS);
  if (!byEmail.allowed) {
    return { allowed: false, retryAfterMs: byEmail.retryAfterMs };
  }
  const byIp = checkRateLimit(ipKey, MAX_ATTEMPTS * 3, WINDOW_MS);
  if (!byIp.allowed) {
    return { allowed: false, retryAfterMs: byIp.retryAfterMs };
  }
  return { allowed: true };
}
