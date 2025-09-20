export type AppErrorOptions = {
  code: string;
  status: number;
  message: string;
  hint?: string;
  severity?: 'info' | 'warning' | 'error';
  cause?: unknown;
  expose?: boolean;
};

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly hint?: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly expose: boolean;
  readonly cause?: unknown;

  constructor({ code, status, message, hint, severity = 'error', cause, expose = true }: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.hint = hint;
    this.severity = severity;
    this.expose = expose;
    if (cause) {
      this.cause = cause;
    }
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export type SerializedError = {
  ok: false;
  code: string;
  reason: string;
  hint?: string;
  severity: 'info' | 'warning' | 'error';
};

export function toErrorResponse(error: unknown): { body: SerializedError; status: number } {
  if (isAppError(error)) {
    return {
      body: {
        ok: false,
        code: error.code,
        reason: error.message,
        hint: error.hint,
        severity: error.severity,
      },
      status: error.status,
    };
  }
  return {
    body: {
      ok: false,
      code: 'APP-500-UNEXPECTED',
      reason: '予期しないエラーが発生しました',
      hint: '時間をおいて再度お試しください',
      severity: 'error',
    },
    status: 500,
  };
}
