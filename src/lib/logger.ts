type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogPayload = {
  code?: string;
  message: string;
  route?: string;
  userId?: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: unknown;
};

const levelToConsole: Record<LogLevel, (message?: unknown, ...optional: unknown[]) => void> = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function serializeError(err: unknown): Record<string, unknown> | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  if (typeof err === 'object') {
    try {
      return JSON.parse(JSON.stringify(err));
    } catch {
      return { message: String(err) };
    }
  }
  return { message: String(err) };
}

function baseLog(level: LogLevel, payload: LogPayload) {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    code: payload.code,
    message: payload.message,
    route: payload.route,
    userId: payload.userId,
    correlationId: payload.correlationId,
    context: payload.context,
    error: serializeError(payload.error),
  };
  levelToConsole[level](JSON.stringify(entry));
}

export const logger = {
  debug(payload: LogPayload) {
    baseLog('debug', payload);
  },
  info(payload: LogPayload) {
    baseLog('info', payload);
  },
  warn(payload: LogPayload) {
    baseLog('warn', payload);
  },
  error(payload: LogPayload) {
    baseLog('error', payload);
  },
};

export type { LogPayload, LogLevel };
