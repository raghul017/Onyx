// =============================================================================
// Structured logger (pino) — the single logging entry point for the server.
//
//   - Level from LOG_LEVEL (default "info").
//   - Pretty, colorized output in dev; raw JSON lines in production (and under
//     tests, so no pino-pretty worker thread is spawned during Vitest).
//   - Defensive redaction so tokens / passwords / auth headers never hit a log
//     line even if a caller accidentally passes an object that contains them.
//
// Create child loggers with logger.child({ testRunId, jobId, ... }) at call
// sites that have contextual IDs, so every downstream line carries them.
// =============================================================================

import pino from "pino";

const level = process.env.LOG_LEVEL || "info";
const isProduction = process.env.NODE_ENV === "production";
// pino-pretty spins up a transport worker thread; skip it in prod (JSON logs for
// aggregators) and under Vitest (keep the test process clean and synchronous).
const usePretty = !isProduction && !process.env.VITEST;

export const logger = pino({
    level,
    // Drop pid/hostname noise — not useful for this single-service deploy.
    base: undefined,
    // Never emit secrets, even if an object carrying them is logged by mistake.
    redact: {
        paths: [
            "authorization",
            "*.authorization",
            "req.headers.authorization",
            "headers.authorization",
            "*.password",
            "*.passwordHash",
            "*.token",
            "*.accessToken",
            "*.access_token",
            "*.refreshToken",
            "*.secret",
            "*.apiKey",
            "*.api_key",
        ],
        censor: "[redacted]",
    },
    ...(usePretty
        ? {
              transport: {
                  target: "pino-pretty",
                  options: {
                      colorize: true,
                      translateTime: "SYS:HH:MM:ss",
                      ignore: "pid,hostname",
                  },
              },
          }
        : {}),
});

export type Logger = typeof logger;
