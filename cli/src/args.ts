// =============================================================================
// Minimal, dependency-free argument parser for `onyx scan`.
// Supports `--flag value`, `--flag=value`, and `-h/--help`.
// =============================================================================

import type { Severity } from "./types.js";

export type OutputFormat = "table" | "json" | "sarif";
export type FailOn = "critical" | "high" | "medium" | "low";

export interface ScanOptions {
    spec: string;
    authRecipe?: string;
    failOn: FailOn;
    format: OutputFormat;
    out?: string;
    /** Also write a SARIF report to this file, regardless of --format (CI). */
    sarifOut?: string;
    apiUrl: string;
    apiToken: string;
    orgId?: string;
    timeoutSeconds: number;
}

export interface ParseResult {
    /** null when help/version was requested (already printed by caller). */
    options: ScanOptions | null;
    /** true when --help/-h was requested. */
    help: boolean;
    /** validation error to print, if any. */
    error?: string;
}

const FAIL_ON_VALUES: FailOn[] = ["critical", "high", "medium", "low"];
const FORMAT_VALUES: OutputFormat[] = ["table", "json", "sarif"];

export const SEVERITY_RANK: Record<Severity, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
    INFO: 0,
};

const DEFAULT_API_URL = "http://localhost:3000";
const DEFAULT_TIMEOUT_SECONDS = 300;

export const HELP_TEXT = `onyx scan — run an Onyx API security scan and gate CI on the result.

USAGE
  onyx scan --spec <url> [options]

REQUIRED
  --spec <url>            PUBLIC OpenAPI/Swagger URL to scan.
                          (Local-file / upload specs are NOT supported yet — see T18.)
  --api-token <token>     API token (or set ONYX_TOKEN). Never printed.

OPTIONS
  --auth-recipe <id>      Attach an existing auth recipe to the run.
  --fail-on <level>       critical | high | medium | low   (default: high)
                          Exit 1 if any finding is at/above this severity.
  --format <fmt>          table | json | sarif             (default: table)
  --out <file>            Write json/sarif output to a file (else stdout).
  --sarif-out <file>      Also write a SARIF report here (any --format) — for CI.
  --api-url <url>         Onyx API base URL (or ONYX_API_URL).
                          (default: ${DEFAULT_API_URL}; "/api" is appended if missing)
  --org <id>              Organization context (or ONYX_ORG) — x-org-id header.
  --timeout <seconds>     Max time to wait for the run to finish (default: ${DEFAULT_TIMEOUT_SECONDS}).
  -h, --help              Show this help.

EXIT CODES
  0  scan finished; no finding at/above --fail-on
  1  scan finished; at least one finding at/above --fail-on
  2  operational failure (auth, unverified domain, timeout, run FAILED, network)

EXAMPLES
  ONYX_TOKEN=onyx_xxx onyx scan --spec https://api.example.com/openapi.json
  onyx scan --spec https://api.example.com/openapi.json --fail-on critical --format sarif --out onyx.sarif
`;

/** Parse `onyx scan` argv (the args AFTER the `scan` subcommand). */
export function parseScanArgs(
    argv: string[],
    env: NodeJS.ProcessEnv = process.env,
): ParseResult {
    const flags: Record<string, string | boolean> = {};

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === "-h" || arg === "--help") {
            return { options: null, help: true };
        }
        if (!arg.startsWith("--")) {
            return { options: null, help: false, error: `Unexpected argument: ${arg}` };
        }
        const eq = arg.indexOf("=");
        if (eq !== -1) {
            flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        } else {
            const key = arg.slice(2);
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith("--")) {
                flags[key] = next;
                i++;
            } else {
                flags[key] = true; // valueless flag (not used by scan, but tolerate)
            }
        }
    }

    const str = (k: string): string | undefined =>
        typeof flags[k] === "string" ? (flags[k] as string) : undefined;

    const spec = str("spec");
    const apiToken = str("api-token") ?? env.ONYX_TOKEN;
    const apiUrlRaw = str("api-url") ?? env.ONYX_API_URL ?? DEFAULT_API_URL;
    const orgId = str("org") ?? env.ONYX_ORG;
    const failOn = (str("fail-on") ?? "high").toLowerCase() as FailOn;
    const format = (str("format") ?? "table").toLowerCase() as OutputFormat;
    const out = str("out");
    const sarifOut = str("sarif-out");
    const authRecipe = str("auth-recipe");
    const timeoutStr = str("timeout");

    if (!spec) return { options: null, help: false, error: "Missing required --spec <url>." };
    if (!apiToken) {
        return { options: null, help: false, error: "Missing API token — pass --api-token or set ONYX_TOKEN." };
    }
    if (!FAIL_ON_VALUES.includes(failOn)) {
        return { options: null, help: false, error: `Invalid --fail-on "${failOn}" (use: ${FAIL_ON_VALUES.join(" | ")}).` };
    }
    if (!FORMAT_VALUES.includes(format)) {
        return { options: null, help: false, error: `Invalid --format "${format}" (use: ${FORMAT_VALUES.join(" | ")}).` };
    }
    const timeoutSeconds = timeoutStr ? Number(timeoutStr) : DEFAULT_TIMEOUT_SECONDS;
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
        return { options: null, help: false, error: `Invalid --timeout "${timeoutStr}".` };
    }

    // Normalize the API base to end with /api (mirrors the web client behavior).
    const apiUrl = normalizeApiUrl(apiUrlRaw);

    return {
        options: { spec, authRecipe, failOn, format, out, sarifOut, apiUrl, apiToken, orgId, timeoutSeconds },
        help: false,
    };
}

export function normalizeApiUrl(raw: string): string {
    let url = raw.replace(/\/+$/, "");
    if (!url.endsWith("/api")) url += "/api";
    return url;
}
