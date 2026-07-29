// =============================================================================
// Table formatter — a readable terminal summary (plain text, no color deps).
// =============================================================================

import type { RunReport } from "../findings.js";
import { owaspCoverage } from "../findings.js";

function pad(s: string, n: number): string {
    return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

export function renderTable(report: RunReport): string {
    const lines: string[] = [];
    const c = report.severityCounts;

    lines.push("");
    lines.push(`Onyx scan — ${report.specUrl}`);
    lines.push(`Run ${report.runId} · ${report.status}`);
    lines.push("");
    lines.push(`Security score: ${report.overallScore}/100 (${report.scoreLabel})`);
    lines.push(
        `Severity:  CRITICAL ${c.critical}  HIGH ${c.high}  MEDIUM ${c.medium}  LOW ${c.low}  INFO ${c.info}`,
    );

    // OWASP coverage (only categories that had findings).
    const coverage = owaspCoverage(report.findings);
    const covKeys = Object.keys(coverage).sort();
    if (covKeys.length > 0) {
        lines.push(`OWASP:     ${covKeys.map((k) => `${k}(${coverage[k]})`).join("  ")}`);
    }

    lines.push("");
    if (report.findings.length === 0) {
        lines.push("No findings at or above LOW severity. ✓");
        lines.push("");
        return lines.join("\n");
    }

    lines.push(`Findings (${report.findings.length}):`);
    lines.push(
        `  ${pad("SEVERITY", 9)} ${pad("OWASP", 7)} ${pad("METHOD", 7)} ${pad("ENDPOINT", 34)} TITLE`,
    );
    for (const f of report.findings) {
        lines.push(
            `  ${pad(f.severity, 9)} ${pad(f.owaspCode ?? "—", 7)} ${pad(f.method, 7)} ${pad(f.endpoint, 34)} ${f.title}`,
        );
    }
    lines.push("");
    return lines.join("\n");
}
