export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INSUFFICIENT_SCOPE"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR"
  | "FEATURE_DISABLED";

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function validationError(message: string, details: unknown[] = []) {
  return new ApiError("VALIDATION_ERROR", message, 400, details);
}

export function notFound(resource: string) {
  return new ApiError("NOT_FOUND", `${resource} não encontrado`, 404);
}

export function conflict(message: string) {
  return new ApiError("CONFLICT", message, 409);
}

export function insufficientScope(scope: string) {
  return new ApiError("INSUFFICIENT_SCOPE", `Escopo necessário: ${scope}`, 403);
}

export function unauthorized(message = "Credenciais inválidas") {
  return new ApiError("UNAUTHORIZED", message, 401);
}

export function rateLimited(retryAfterSec: number) {
  return new ApiError("RATE_LIMITED", "Limite de requisições excedido", 429, [
    { retryAfter: retryAfterSec },
  ]);
}
