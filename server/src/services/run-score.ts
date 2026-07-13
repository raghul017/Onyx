// =============================================================================
// Run score — compute a test run's overall score from its logs and persist it
// on the run row, so the history list never has to load every log to re-derive
// it. Backward-compatible: if the denormalized columns aren't in the DB yet
// (pre-migration), every write here is a safe no-op and callers keep computing
// the score on read exactly as before.
// =============================================================================

import { prisma } from "../lib/prisma.js";
import { getSeverity, getOverallScore, getScoreLabel } from "../utils/severity.js";

/** True when an error is Prisma's "column does not exist" (P2022) for the
 *  not-yet-migrated score columns. Treated as "feature off", never a failure. */
export function isMissingScoreColumn(e: unknown): boolean {
    const anyErr = e as { code?: string; message?: string };
    if (anyErr?.code === "P2022") return true;
    const msg = anyErr?.message ?? String(e);
    return /overallScore|scoreLabel|column .* does not exist/i.test(msg);
}

/** Compute overallScore + scoreLabel for a run from its logs. */
export function computeScore(
    logs: { statusCode: number | null; attackType: string; responseSnippet: string | null }[],
): { overallScore: number; scoreLabel: ReturnType<typeof getScoreLabel> } {
    const scored = logs.map((l) => ({
        severity: getSeverity(l.attackType, l.statusCode ?? 0, l.responseSnippet ?? ""),
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
            select: { statusCode: true, attackType: true, responseSnippet: true },
        });
        const { overallScore, scoreLabel } = computeScore(logs);
        await prisma.testRun.update({
            where: { id: testRunId },
            data: { overallScore, scoreLabel },
        });
    } catch (e) {
        if (isMissingScoreColumn(e)) return; // columns not pushed yet — compute on read
        console.error(
            `[Score] Failed to persist score for ${testRunId.slice(0, 8)}...:`,
            e instanceof Error ? e.message : e,
        );
    }
}
