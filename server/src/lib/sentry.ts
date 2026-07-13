// =============================================================================
// Sentry — optional error tracking, gated entirely on SENTRY_DSN.
//
// When SENTRY_DSN is unset (local dev, CI), every function here is a safe no-op:
// initSentry() returns false and captureException() does nothing. No DSN is ever
// required to run the server. We use manual captureException() (not the OTEL
// auto-instrumentation) so import order and perf tracing don't matter — this is
// pure error reporting.
// =============================================================================

import * as Sentry from "@sentry/node";
import { logger } from "./logger.js";

let enabled = false;
let initialized = false;
let handlersInstalled = false;

/**
 * Initialize Sentry once, from either the HTTP entrypoint or the worker
 * bootstrap. Idempotent: a second call (e.g. worker + HTTP in one process)
 * is a no-op. Returns true when reporting is active.
 */
export function initSentry(context: "http" | "worker"): boolean {
    if (initialized) return enabled;
    initialized = true;

    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        logger.info({ context }, "Sentry disabled — no SENTRY_DSN set");
        return false;
    }

    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || "development",
        // Error tracking only — no performance/tracing sampling overhead.
        tracesSampleRate: 0,
    });
    enabled = true;
    logger.info({ context }, "Sentry initialized");
    return true;
}

/** Report an error to Sentry with optional context. No-op when disabled. */
export function captureException(
    err: unknown,
    context?: Record<string, unknown>,
): void {
    if (!enabled) return;
    Sentry.captureException(err, context ? { extra: context } : undefined);
}

/**
 * Wire process-level fault handlers once. Logs fatally and (if enabled) reports
 * to Sentry. Installed from the main entrypoint; guarded so it never doubles up.
 */
export function installGlobalErrorHandlers(): void {
    if (handlersInstalled) return;
    handlersInstalled = true;

    process.on("unhandledRejection", (reason) => {
        logger.error({ err: reason }, "Unhandled promise rejection");
        captureException(reason, { kind: "unhandledRejection" });
    });

    process.on("uncaughtException", (err) => {
        logger.fatal({ err }, "Uncaught exception");
        captureException(err, { kind: "uncaughtException" });
    });
}

export { Sentry };
