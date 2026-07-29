// =============================================================================
// Scan flow: create a run → poll to completion → render output → exit code.
// The API client + IO are injected so the whole flow is unit-testable offline.
// =============================================================================

import type { ScanOptions } from "./args.js";
import type { OnyxApi } from "./client.js";
import type { ScanIO } from "./io.js";
import { OnyxError, TimeoutError } from "./errors.js";
import { TERMINAL_STATUSES, type GetRunResponse } from "./types.js";
import { buildReport, computeExitCode } from "./findings.js";
import { renderTable } from "./format/table.js";
import { renderJson } from "./format/json.js";
import { renderSarif } from "./format/sarif.js";

const POLL_START_MS = 1000;
const POLL_MAX_MS = 5000;

/** Poll GET /test-runs/:id until COMPLETED/FAILED or the timeout is hit. */
async function pollUntilTerminal(
    runId: string,
    opts: ScanOptions,
    api: OnyxApi,
    io: ScanIO,
): Promise<GetRunResponse> {
    const deadline = io.now() + opts.timeoutSeconds * 1000;
    let delay = POLL_START_MS;
    for (;;) {
        const run = await api.getRun(runId);
        const s = run.summary.status;
        io.progress(
            `[onyx] ${s} — ${run.summary.completedAttacks}/${run.summary.totalAttacks || "?"} attacks`,
        );
        if (TERMINAL_STATUSES.includes(s)) return run;
        if (io.now() >= deadline) throw new TimeoutError(opts.timeoutSeconds);
        await io.sleep(delay);
        delay = Math.min(POLL_MAX_MS, Math.round(delay * 1.5));
    }
}

/** Run a scan end-to-end. Returns the process exit code (0 / 1 / 2). */
export async function runScan(
    opts: ScanOptions,
    api: OnyxApi,
    io: ScanIO,
): Promise<number> {
    try {
        io.progress(`[onyx] creating run for ${opts.spec}`);
        const created = await api.createRun(opts.spec, opts.authRecipe);
        const runId = created.testRunId;
        io.progress(`[onyx] run ${runId} created — waiting for completion…`);

        const run = await pollUntilTerminal(runId, opts, api, io);

        if (run.summary.status === "FAILED") {
            throw new OnyxError(
                "The scan run FAILED on the server.",
                "Open the run in the Onyx dashboard to see why (spec parse error, aborted, etc.).",
            );
        }

        // COMPLETED — build + render the report.
        const report = buildReport(runId, run);
        const rendered =
            opts.format === "json"
                ? renderJson(report)
                : opts.format === "sarif"
                  ? renderSarif(report)
                  : renderTable(report);

        if (opts.out && opts.format !== "table") {
            await io.writeFile(opts.out, rendered + "\n");
            io.progress(`[onyx] wrote ${opts.format} report to ${opts.out}`);
            // Still show a human summary in the CI log.
            io.log(renderTable(report));
        } else {
            io.log(rendered);
        }

        // Optionally also emit SARIF (any --format) — lets CI produce json + sarif
        // from a SINGLE scan (no double-charging).
        if (opts.sarifOut) {
            await io.writeFile(opts.sarifOut, renderSarif(report) + "\n");
            io.progress(`[onyx] wrote sarif report to ${opts.sarifOut}`);
        }

        const code = computeExitCode(report.findings, opts.failOn);
        io.progress(
            `[onyx] fail-on=${opts.failOn} → exit ${code} (${report.findings.length} finding(s))`,
        );
        return code;
    } catch (err) {
        if (err instanceof OnyxError) {
            io.error(`\nError: ${err.message}`);
            if (err.hint) io.error(`Hint: ${err.hint}`);
            return 2;
        }
        io.error(`\nUnexpected error: ${err instanceof Error ? err.message : String(err)}`);
        return 2;
    }
}
