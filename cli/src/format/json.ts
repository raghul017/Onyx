// =============================================================================
// JSON formatter — a stable, machine-readable report shape.
// =============================================================================

import type { NormalizedFinding } from "../types.js";
import { owaspCoverage, type RunReport } from "../findings.js";
import { CLI_VERSION } from "../version.js";

export interface JsonReport {
    onyxCliVersion: string;
    runId: string;
    specUrl: string;
    status: string;
    score: number;
    scoreLabel: string;
    severityCounts: RunReport["severityCounts"];
    owaspCoverage: Record<string, number>;
    findingCount: number;
    findings: Array<{
        method: string;
        endpoint: string;
        statusCode: number;
        severity: string;
        category: string;
        title: string;
        owaspCode: string | null;
        owaspLabel: string;
    }>;
}

export function toJsonReport(report: RunReport): JsonReport {
    return {
        onyxCliVersion: CLI_VERSION,
        runId: report.runId,
        specUrl: report.specUrl,
        status: report.status,
        score: report.overallScore,
        scoreLabel: report.scoreLabel,
        severityCounts: report.severityCounts,
        owaspCoverage: owaspCoverage(report.findings),
        findingCount: report.findings.length,
        findings: report.findings.map((f: NormalizedFinding) => ({
            method: f.method,
            endpoint: f.endpoint,
            statusCode: f.statusCode,
            severity: f.severity,
            category: f.category,
            title: f.title,
            owaspCode: f.owaspCode,
            owaspLabel: f.owaspLabel,
        })),
    };
}

export function renderJson(report: RunReport): string {
    return JSON.stringify(toJsonReport(report), null, 2);
}
