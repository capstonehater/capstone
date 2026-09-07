import type { ErrorResponseDto } from "./dto";
import type { ProductReadError } from "./types";

export function normalizeProductError(
  error: unknown,
  fallbackMessage: string,
): ProductReadError {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    !("status" in error)
  ) {
    return { message: error.message };
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return {
      message: error.message,
      status:
        "status" in error && typeof error.status === "number"
          ? error.status
          : undefined,
      code:
        "code" in error && typeof error.code === "string"
          ? error.code
          : undefined,
      fieldErrors:
        "fieldErrors" in error && typeof error.fieldErrors === "object"
          ? (error.fieldErrors as Record<string, string[]>)
          : undefined,
    };
  }

  return { message: fallbackMessage };
}

export function parseErrorResponse(data: ErrorResponseDto | null): ProductReadError {
  const fallbackMessage = "Request failed";
  const message = Array.isArray(data?.message)
    ? data?.message.join(", ")
    : data?.message ?? data?.error ?? fallbackMessage;

  return {
    message,
    status: data?.statusCode,
    code: data?.code,
    fieldErrors: data?.errors,
  };
}
