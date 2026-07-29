// =============================================================================
// Pure helpers for the Onyx PR comment (T11). CommonJS so the github-script
// step can `require()` it. No deps — unit-tested with a mocked octokit list.
// =============================================================================

/** Hidden marker used to find-and-update our comment (no spam). */
const MARKER = "<!-- onyx-scan -->";

/** Find our existing PR comment by the hidden marker, or null. */
function findMarkerComment(comments) {
    if (!Array.isArray(comments)) return null;
    return comments.find((c) => c && typeof c.body === "string" && c.body.includes(MARKER)) || null;
}

function esc(s) {
    return String(s == null ? "" : s).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
function count(counts, key) {
    return (counts && typeof counts[key] === "number" ? counts[key] : 0);
}

/**
 * Render the PR comment body from the CLI's JSON report (or null when the scan
 * produced no report). `opts.exitCode` (0/1/2) and `opts.failOn` drive the gate.
 */
function buildCommentBody(report, opts = {}) {
    const failOn = opts.failOn || "high";
    const exitCode = opts.exitCode;
    const lines = [MARKER, "## 🛡️ Onyx API Security Scan"];

    if (!report) {
        lines.push(
            "",
            `⚠️ The scan did not produce a report${exitCode != null ? ` (exit code \`${exitCode}\`)` : ""}.`,
            "",
            "This usually means an operational failure — invalid/expired API token, an unverified target domain, a timeout, or the run failed on the server. See the job log for details.",
        );
        return lines.join("\n");
    }

    const gate =
        exitCode === 0
            ? "✅ **Passed**"
            : exitCode === 1
              ? `❌ **Failed** — finding(s) at or above \`${failOn}\``
              : `⚠️ **Errored** (exit code \`${exitCode}\`)`;

    const c = report.severityCounts || {};
    const findings = Array.isArray(report.findings) ? report.findings : [];

    lines.push(
        "",
        `${gate} · Score **${report.score ?? "?"}/100** (${report.scoreLabel ?? "?"}) · Threshold \`${failOn}\``,
        "",
        `| Critical | High | Medium | Low | Info |`,
        `| --- | --- | --- | --- | --- |`,
        `| ${count(c, "critical")} | ${count(c, "high")} | ${count(c, "medium")} | ${count(c, "low")} | ${count(c, "info")} |`,
        "",
    );

    if (findings.length === 0) {
        lines.push("No findings at or above LOW severity. 🎉");
    } else {
        const top = findings.slice(0, 10);
        lines.push(
            `**Top findings (${top.length} of ${findings.length}):**`,
            "",
            `| Severity | OWASP | Endpoint | Title |`,
            `| --- | --- | --- | --- |`,
        );
        for (const f of top) {
            lines.push(
                `| ${esc(f.severity)} | ${esc(f.owaspCode || "—")} | \`${esc(f.method)} ${esc(f.endpoint)}\` | ${esc(f.title)} |`,
            );
        }
        if (findings.length > top.length) {
            lines.push("", `…and ${findings.length - top.length} more.`);
        }
    }

    lines.push(
        "",
        `<sub>Target: ${esc(report.specUrl)} · Run \`${report.runId || "?"}\`${report.onyxCliVersion ? ` · onyx-cli ${esc(report.onyxCliVersion)}` : ""}</sub>`,
    );
    return lines.join("\n");
}

module.exports = { MARKER, findMarkerComment, buildCommentBody };
