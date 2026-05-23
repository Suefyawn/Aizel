// ============================================================================
// Structured logger. Emits one JSON-line per call so any log-aggregator
// (Vercel, Logflare, Datadog, Loki) can parse without regex gymnastics.
//
// Adds a per-request correlation id when called inside a Next.js request
// (the value comes from x-request-id, x-vercel-id, or a UUID we mint).
//
// Drop-in usage:
//   import { log } from '@/lib/logger';
//   log.info('order.placed', { order_id, total });
//   log.error('checkout.exception', err);
// ============================================================================

import { randomUUID } from 'crypto';

type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  level: Level;
  msg: string;
  ts: string;
  request_id?: string;
  [k: string]: unknown;
}

let currentRequestId: string | null = null;

/** Set the correlation id for the duration of a request. Call this once
 *  from a request handler / middleware / server action and the logger
 *  will tag every subsequent line until you reset it. */
export function setRequestId(id: string | null): void {
  currentRequestId = id;
}

export function mintRequestId(): string {
  return randomUUID();
}

function emit(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  const payload: LogFields = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...(currentRequestId ? { request_id: currentRequestId } : {}),
    ...fields,
  };
  // Errors and unknowns: serialise stack + name.
  // Also grab the first Error so we can forward it to Sentry below — server
  // actions that catch + log without re-throwing would otherwise be silent.
  let firstError: Error | null = null;
  for (const [k, v] of Object.entries(payload)) {
    if (v instanceof Error) {
      if (!firstError) firstError = v;
      payload[k] = { name: v.name, message: v.message, stack: v.stack };
    }
  }
  const line = JSON.stringify(payload);
  if (level === 'error')      console.error(line);
  else if (level === 'warn')  console.warn(line);
  else                        console.log(line);

  // Forward errors to Sentry. Lazy import + fire-and-forget so the log
  // call stays synchronous and we don't add a hard dep on monitoring.ts.
  if (level === 'error') {
    import('./monitoring')
      .then(m => m.captureError(firstError ?? new Error(msg), { logger_msg: msg, ...fields }))
      .catch(() => { /* monitoring unavailable — already logged to stderr */ });
  }
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
  info:  (msg: string, fields?: Record<string, unknown>) => emit('info',  msg, fields),
  warn:  (msg: string, fields?: Record<string, unknown>) => emit('warn',  msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
};
