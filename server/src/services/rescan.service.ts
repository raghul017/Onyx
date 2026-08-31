// =============================================================================
// Re-scan a single finding (T15b) — re-run the check that produced ONE AttackLog
// and decide whether it still reproduces.
//
// REUSE, DON'T DUPLICATE: every verdict comes from the SAME exported services the
// original scan used — analyzeFinding (normal attacks), decideMassAssignmentVerdict
// (API3 mass assignment), analyzeResponseExposure/decideExposureVerdict (API3
// data exposure) — so a re-scan can never drift from the scan that raised the
// finding. Requests are built with the same request-builder and are subject to the
// same SSRF guard, timeout, and redaction.
//
// It deliberately does NOT go through the BullMQ worker: those functions take a
// Job, write new AttackLogs, advance run counters, and broadcast progress. A
// re-scan must do none of that — it re-fires ONE check and updates ONE row.
//
// The run's overall score is intentionally left UNCHANGED: a single-finding
// re-check is not a re-scan of the whole surface, so rewriting the run score from
// it would misrepresent the other (unverified) findings. A full re-run is future work.
//
// SUPPORTED today: normal attack findings (injection/XSS/traversal/auth/errors),
// MASS_ASSIGNMENT, and DATA_EXPOSURE.
// DEFERRED: BOLA_REPLAY / BFLA_PROBE — those need a live second identity and the
// acquired object id; they return a clear "not supported" result rather than a
// possibly-wrong verdict.
// =============================================================================

import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { assertNotSSRF } from "../lib/ssrf-guard.js";
import { redactSecrets } from "../lib/redact.js";
import {
    buildAttackRequest,
    buildBenignRequest,
    type AttachedCredential,
} from "../services/request-builder.js";
import type { ParsedParameterInput } from "../validators/schemas.js";
import { analyzeFinding, type BaselineComparison } from "./finding-analysis.js";
import {
    buildMassAssignmentBody,
    decideMassAssignmentVerdict,
} from "./mass-assignment.js";
import { analyzeResponseExposure, decideExposureVerdict } from "./data-exposure.js";
import { CredentialResolver } from "./credential-resolver.js";
import { IdentityCredentialResolver, type IdentityRef } from "./identity-credential-resolver.js";
import { loadRecipeCredential } from "./recipe-credential-loader.js";

const log = logger.child({ component: "rescan" });

const REQUEST_TIMEOUT_MS = 10_000;
const RESPONSE_SNIPPET_MAX_LENGTH = 500;

/** Cross-identity probes need a live second identity + acquired id — deferred. */
const UNSUPPORTED_ATTACK_TYPES = new Set(["BOLA_REPLAY", "BFLA_PROBE"]);

/**
 * analyzeFinding categories that mean the attack did NOT succeed — i.e. the
 * finding no longer reproduces. "Input Rejected" is LOW (not INFO) severity but
 * explicitly means input validation worked, so it MUST count as fixed.
 */
const NOT_REPRODUCED = new Set([
    "Handled",
    "Input Rejected",
    "Access Control Enforced",
    "Request Error",
]);

export type RescanOutcome = "resolved" | "still_present" | "unsupported" | "error";

export interface RescanResult {
    outcome: RescanOutcome;
    /** True only when the check no longer reproduces the finding. */
    resolved: boolean;
    checkedAt: string | null;
    /** Severity of the fresh verdict (null when resolved / unsupported). */
    severity: string | null;
    /** Category of the fresh verdict, for the client. */
    category: string | null;
    /** Human explanation — always set for unsupported/error. */
    message: string;
}

/** One fired request's result, already redacted. */
interface FireResult {
    statusCode: number;
    latencyMs: number;
    snippet: string;
    bodyLength: number;
}

/** Fires a built request. Injected so tests need no network. */
export type Firer = (req: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
}) => Promise<FireResult>;

/** The default firer — real HTTP with the same timeout the scan uses. */
const defaultFirer: Firer = async (req) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const start = Date.now();
    try {
        const res = await fetch(req.url, {
            method: req.method,
            headers: req.headers,
            body: req.body,
            signal: controller.signal,
            redirect: "follow",
        });
        let text = "";
        try {
            text = await res.text();
        } catch {
            text = "";
        }
        return {
            statusCode: res.status,
            latencyMs: Date.now() - start,
            snippet: text.slice(0, RESPONSE_SNIPPET_MAX_LENGTH),
            bodyLength: text.length,
        };
    } finally {
        clearTimeout(timeout);
    }
};

const credentialResolver = new CredentialResolver(loadRecipeCredential);
const identityCredentialResolver = new IdentityCredentialResolver(
    credentialResolver,
    async (identityId: string): Promise<IdentityRef | null> =>
        prisma.runIdentity.findUnique({
            where: { id: identityId },
            select: { id: true, testRunId: true, authRecipeId: true },
        }),
);

/** Derive the API base from the run's spec URL, mirroring the scan. */
export function baseUrlFromSpec(specUrl: string): string {
    try {
        const u = new URL(specUrl);
        return `${u.protocol}//${u.host}`;
    } catch {
        return "";
    }
}

function unsupported(message: string): RescanResult {
    return {
        outcome: "unsupported",
        resolved: false,
        checkedAt: null,
        severity: null,
        category: null,
        message,
    };
}

function failed(message: string): RescanResult {
    return {
        outcome: "error",
        resolved: false,
        checkedAt: null,
        severity: null,
        category: null,
        message,
    };
}

export interface RescanDeps {
    fire?: Firer;
}

/**
 * Re-run the check behind ONE AttackLog. Returns the outcome and updates the
 * row's resolvedAt/lastCheckedAt. Never throws for expected conditions.
 */
export async function rescanFinding(
    logId: string,
    deps: RescanDeps = {},
): Promise<RescanResult> {
    const fire = deps.fire ?? defaultFirer;

    const row = await prisma.attackLog.findUnique({
        where: { id: logId },
        select: {
            id: true,
            testRunId: true,
            endpointId: true,
            method: true,
            path: true,
            payload: true,
            attackType: true,
            identityId: true,
            findingJson: true,
            testRun: { select: { specUrl: true } },
            endpoint: { select: { requestBodySchema: true, parameters: true } },
        },
    });
    if (!row) return failed("Finding not found.");

    if (UNSUPPORTED_ATTACK_TYPES.has(row.attackType)) {
        return unsupported(
            "Re-scanning cross-identity findings (BOLA/BFLA) isn't supported yet — " +
                "they need a live second identity and the original object id. Re-run the full scan to re-verify.",
        );
    }

    const baseUrl = baseUrlFromSpec(row.testRun.specUrl);
    if (!baseUrl) return failed("Could not derive the target base URL for this run.");

    // Same credential the original check used (the row's identity), if any.
    let credential: AttachedCredential | null = null;
    if (row.identityId) {
        try {
            const resolved = await identityCredentialResolver.resolveForIdentity(row.identityId);
            credential = resolved.value;
        } catch {
            credential = null; // fire un-authenticated rather than fail the rescan
        }
    }

    const requestBodySchema = (row.endpoint.requestBodySchema ?? null) as Record<
        string,
        unknown
    > | null;

    // T15b-fix: re-fire with the endpoint's ORIGINAL parameters so a query- or
    // header-parameter finding is reconstructed exactly and can't false-resolve.
    // Legacy rows (created before the column existed) are null → fall back to [],
    // i.e. exactly the pre-fix behavior for that older data.
    const parameters = Array.isArray(row.endpoint.parameters)
        ? (row.endpoint.parameters as ParsedParameterInput[])
        : [];

    try {
        // ---- Build the SAME request the original check sent -----------------
        const isMassAssignment = row.attackType === "MASS_ASSIGNMENT";
        const isDataExposure = row.attackType === "DATA_EXPOSURE";

        // Mass assignment re-sends the merged probe body; data exposure just
        // re-requests the endpoint benignly; everything else replays the payload.
        const built = isDataExposure
            ? buildBenignRequest({
                  method: row.method,
                  path: row.path,
                  baseUrl,
                  parameters,
                  requestBodySchema,
                  credential,
              })
            : buildAttackRequest({
                  method: row.method,
                  path: row.path,
                  baseUrl,
                  payload: isMassAssignment
                      ? buildMassAssignmentBody(requestBodySchema).body
                      : row.payload,
                  attackType: row.attackType,
                  parameters,
                  requestBodySchema,
                  credential,
              });

        await assertNotSSRF(built.url);

        const res = await fire({
            url: built.url,
            method: built.method,
            headers: built.headers,
            body: built.body,
        });

        // Redact before anything is stored or returned (same guarantee as the scan).
        const snippet = redactSecrets(res.snippet ?? "").slice(0, RESPONSE_SNIPPET_MAX_LENGTH);

        // ---- Re-run the ORIGINAL verdict logic ------------------------------
        let stillPresent: boolean;
        let severity: string | null = null;
        let category: string | null = null;

        if (isMassAssignment) {
            const { injected } = buildMassAssignmentBody(requestBodySchema);
            const finding = await decideMassAssignmentVerdict({
                method: row.method,
                path: row.path,
                statusCode: res.statusCode,
                responseSnippet: snippet,
                requestBody: buildMassAssignmentBody(requestBodySchema).body,
                injectedFields: injected,
            });
            stillPresent = finding != null;
            severity = finding?.severity ?? null;
            category = finding?.category ?? null;
        } else if (isDataExposure) {
            const analysis = analyzeResponseExposure(res.statusCode, snippet);
            const finding = await decideExposureVerdict(
                {
                    method: row.method,
                    path: row.path,
                    statusCode: res.statusCode,
                    bodySnippet: snippet,
                },
                analysis,
            );
            stillPresent = finding != null;
            severity = finding?.severity ?? null;
            category = finding?.category ?? null;
        } else {
            // Normal attack: re-analyze against the endpoint's baseline, exactly
            // as the scan did, so baseline-aware rules behave identically.
            const baselineRow = await prisma.baselineResponse.findUnique({
                where: {
                    testRunId_endpointId: {
                        testRunId: row.testRunId,
                        endpointId: row.endpointId,
                    },
                },
                select: { status: true, latencyMs: true, bodyLength: true, bodySnippet: true },
            });
            const baseline: BaselineComparison | null = baselineRow ?? null;

            const finding = analyzeFinding(
                {
                    attackType: row.attackType,
                    method: row.method,
                    statusCode: res.statusCode,
                    latencyMs: res.latencyMs,
                    payload: row.payload,
                    responseSnippet: snippet,
                    bodyLength: res.bodyLength,
                },
                baseline,
            );
            // "Still present" = the fresh verdict is an actual finding.
            //
            // The categories below all mean the attack did NOT succeed, so the
            // original issue no longer reproduces:
            //   Handled / Access Control Enforced / Request Error → INFO
            //   Input Rejected  → LOW + confidence "info" ("validation is doing
            //                     its job") — the textbook FIXED outcome, which a
            //                     severity-only check would wrongly call unresolved.
            // Every one of these carries confidence "info", so we key on the
            // category set plus that marker rather than on severity alone.
            stillPresent = !(NOT_REPRODUCED.has(finding.category) || finding.confidence === "info");
            severity = finding.severity;
            category = finding.category;
        }

        const now = new Date();
        await prisma.attackLog.update({
            where: { id: row.id },
            data: {
                lastCheckedAt: now,
                // Resolved only when the check no longer reproduces; a still-present
                // finding CLEARS any previous resolvedAt (it regressed).
                resolvedAt: stillPresent ? null : now,
            },
        });

        log.info(
            { logId: row.id, attackType: row.attackType, stillPresent },
            "Finding re-scanned",
        );

        return {
            outcome: stillPresent ? "still_present" : "resolved",
            resolved: !stillPresent,
            checkedAt: now.toISOString(),
            severity: stillPresent ? severity : null,
            category: stillPresent ? category : null,
            message: stillPresent
                ? "This finding still reproduces."
                : "This check no longer reproduces — marked resolved.",
        };
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        log.error({ logId, reason }, "Re-scan failed");
        return failed(`Could not complete the re-scan: ${reason}`);
    }
}
