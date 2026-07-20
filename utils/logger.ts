/**
 * Structured JSON-line logging for Vercel's stdout log capture. Never pass
 * secrets (API keys, tokens, full auth headers) into `data`.
 */
type LogLevel = 'info' | 'warn' | 'error';

interface LogEvent {
  level: LogLevel;
  event: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

function emit(level: LogLevel, event: string, data?: Record<string, unknown>): void {
  const entry: LogEvent = { level, event, data, timestamp: new Date().toISOString() };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => emit('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => emit('error', event, data),
};
