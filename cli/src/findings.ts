// =============================================================================
// Findings normalization + fail-on threshold logic (pure).
// =============================================================================

import type { AttackResult, NormalizedFinding, Severity, GetRunResponse } from "./types.js";
import { owaspShortCode, owaspLabel } from "./owasp.js";
import { SEVERITY_RANK, type FailOn } from "./args.js";

/**
 * The reportable findings from a run: every attack result whose severity is at
 * or above LOW (INFO results are healthy/handled probes — kept out of the SARIF
 * results and the findings list, but still counted in the severity summary).
 */
export function normalizeFindings(logs: AttackResult[]): NormalizedFinding[] {
    return logs
        .filter((l) => l.severity !== "INFO")
        .map((l) => {
            const owaspCategory = l.finding?.owaspCategory ?? null;
            return {
                method: l.method,
                endpoint: l.endpoint,
                statusCode: l.statusCode,
                severity: l.severity,
                category: l.finding?.category ?? l.attackType,
                title: l.finding?.title ?? `${l.attackType} result`,
                owaspCode: owaspShortCode(owaspCategory),
                owaspLabel: owaspLabel(owaspCategory),
                owaspCategory,
            };
        })
        .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

/** True when any finding is at or above the --fail-on threshold. */
export function hasFindingAtOrAbove(
    findings: { severity: Severity }[],
    failOn: FailOn,
): boolean {
    const threshold = SEVERITY_RANK[failOn.toUpperCase() as Severity];
    return findings.some((f) => SEVERITY_RANK[f.severity] >= threshold);
}

/** The exit code the scan should use, given findings + threshold. */
export function computeExitCode(
    findings: { severity: Severity }[],
    failOn: FailOn,
): 0 | 1 {
    return hasFindingAtOrAbove(findings, failOn) ? 1 : 0;
}

/** Count findings per OWASP short code (from normalized findings). */
export function owaspCoverage(findings: NormalizedFinding[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const f of findings) {
        const key = f.owaspCode ?? "Unmapped";
        out[key] = (out[key] ?? 0) + 1;
    }
    return out;
}

/** Convenience: pull the parts the formatters need out of a run response. */
export interface RunReport {
    runId: string;
    specUrl: string;
    status: string;
    overallScore: number;
    scoreLabel: string;
    severityCounts: GetRunResponse["summary"]["severityBreakdown"];
    findings: NormalizedFinding[];
}

export function buildReport(runId: string, run: GetRunResponse): RunReport {
    return {
        runId,
        specUrl: run.summary.specUrl,
        status: run.summary.status,
        overallScore: run.summary.overallScore,
        scoreLabel: run.summary.scoreLabel,
        severityCounts: run.summary.severityBreakdown,
        findings: normalizeFindings(run.logs),
    };
}
