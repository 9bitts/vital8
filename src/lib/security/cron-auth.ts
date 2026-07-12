/**
 * Jobs/cron: falha fechada em produção se segredo não configurado.
 */
export function assertCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.JOBS_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return true;
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
