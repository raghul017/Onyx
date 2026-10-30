// =============================================================================
// Run score — compute a test run's overall score from its logs and persist it
// on the run row, so the history list never has to load every log to re-derive
// it. Backward-compatible: if the denormalized columns aren't in the DB yet
// (pre-migration), every write here is a safe no-op and callers keep computing
// the score on read exactly as before.
// =============================================================================

import { prisma } from "../lib/prisma.js";
import { getSeverity, getOverallScore, getScoreLabel, type SeverityLevel } from "../utils/severity.js";
import { logger } from "../lib/logger.js";

/**
 * Version of the scoring rules. Bump when a rule change moves severities, so
 * scores persisted under the old rules are recomputed on the next read.
 *   1 — healthy 4xx / 401 / 403 results are INFO (no deduction); a 4xx is only
 *       MEDIUM when it leaks real internals.
 *   2 — a 5xx whose body is an edge/platform error page (proxy, load balancer,
 *       PaaS cold start) and carries no stack trace is INFO ("not
 *       attributable"), not a CRITICAL/HIGH crash.
 */
export const SCORE_VERSION = 2;

/** A stored score is only trusted when the current rules produced it. */
export function isStoredScoreFresh(run: {
    overallScore: number | null;
    scoreLabel: string | null;
    scoreVersion: number | null;
}): boolean {
    return run.overallScore != null && run.scoreLabel != null && run.scoreVersion === SCORE_VERSION;
}

/** True when an error is Prisma's "column does not exist" (P2022) for the
 *  not-yet-migrated score columns. Treated as "feature off", never a failure. */
export function isMissingScoreColumn(e: unknown): boolean {
    const anyErr = e as { code?: string; message?: string };
    if (anyErr?.code === "P2022") return true;
    const msg = anyErr?.message ?? String(e);
    return /overallScore|scoreLabel|scoreVersion|column .* does not exist/i.test(msg);
}

/** Severity stored on a persisted finding (T13b), when the row carries one. */
function storedSeverity(findingJson: unknown): SeverityLevel | null {
    if (!findingJson || typeof findingJson !== "object") return null;
    const sev = (findingJson as Record<string, unknown>).severity;
    return typeof sev === "string" &&
        ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].includes(sev)
        ? (sev as SeverityLevel)
        : null;
}

/** Compute overallScore + scoreLabel for a run from its logs. */
export function computeScore(
    logs: {
        statusCode: number | null;
        attackType: string;
        responseSnippet: string | null;
        // T13b: rows with a PERSISTED finding (BOLA) contribute that severity,
        // since it can't be re-derived from a single row. Optional → all other
        // rows (and pre-T13b callers) score exactly as before.
        findingJson?: unknown;
    }[],
): { overallScore: number; scoreLabel: ReturnType<typeof getScoreLabel> } {
    const scored = logs.map((l) => ({
        severity:
            storedSeverity(l.findingJson) ??
            getSeverity(l.attackType, l.statusCode ?? 0, l.responseSnippet ?? ""),
    }));
    const overallScore = getOverallScore(scored);
    return { overallScore, scoreLabel: getScoreLabel(overallScore) };
}

/**
 * Compute a run's score from its logs and persist it on the run. Call once when
 * a run reaches a terminal state (COMPLETED / FAILED / aborted). Fire-and-forget:
 * safe no-op if the score columns aren't in the DB yet.
 */
export async function scoreAndPersistRun(testRunId: string): Promise<void> {
    try {
        const logs = await prisma.attackLog.findMany({
            where: { testRunId },
            select: { statusCode: true, attackType: true, responseSnippet: true, findingJson: true },
        });
        const { overallScore, scoreLabel } = computeScore(logs);
        const warning = baseUrlWarning(logs);
        await prisma.testRun.update({
            where: { id: testRunId },
            data: {
                overallScore,
                scoreLabel,
                scoreVersion: SCORE_VERSION,
                ...(warning ? { errorMessage: warning } : {}),
            },
        });
    } catch (e) {
        if (isMissingScoreColumn(e)) return; // columns not pushed yet — compute on read
        logger.error(
            { component: "run-score", testRunId, err: e },
            "Failed to persist score",
        );
    }
}

/**
 * Detects a run that almost certainly targeted the wrong base path.
 *
 * When nearly every attack comes back 404, the scan never reached the API:
 * the findings are noise and the score is meaningless. This is cheap to spot
 * and far more useful to the user than a confident 0/100, so it is surfaced on
 * the run. Returns null for normal runs.
 */
export function baseUrlWarning(
    logs: { statusCode: number | null }[],
): string | null {
    // Only meaningful once there are enough results to be representative.
    const answered = logs.filter((l) => typeof l.statusCode === "number" && l.statusCode > 0);
    if (answered.length < 20) return null;

    const notFound = answered.filter((l) => l.statusCode === 404).length;
    const ratio = notFound / answered.length;
    if (ratio < 0.9) return null;

    return (
        `${Math.round(ratio * 100)}% of requests returned 404. The scan probably ` +
        `targeted the wrong base path, so these results are not meaningful. Check that ` +
        `the spec's declared server (its "servers" / "basePath") matches where the API ` +
        `is actually mounted, then re-run.`
    );
}
