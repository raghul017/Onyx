// Scan flow with a MOCKED api client + IO: create → poll → findings → exit code,
// including a FAILED run, a 401 (auth), and a timeout.
import { describe, it, expect, vi } from "vitest";
import { runScan } from "../src/scan.js";
import type { OnyxApi } from "../src/client.js";
import type { ScanIO } from "../src/io.js";
import type { ScanOptions } from "../src/args.js";
import type { AttackResult, GetRunResponse, RunStatus, Severity } from "../src/types.js";
import { AuthError } from "../src/errors.js";

const baseOpts: ScanOptions = {
    spec: "https://api.example.com/openapi.json",
    failOn: "high",
    format: "table",
    apiUrl: "http://localhost:3000/api",
    apiToken: "onyx_test",
    timeoutSeconds: 300,
};

function log(severity: Severity, over: Partial<AttackResult> = {}): AttackResult {
    return {
        id: Math.random().toString(36).slice(2),
        method: "GET",
        endpoint: "/x",
        statusCode: 200,
        responseTime: 10,
        attackType: "SQL_INJECTION",
        severity,
        finding: { severity, category: "SQL Injection", title: "t", cause: "", evidence: null, remediation: "", confidence: "confirmed", owaspCategory: "API8_SECURITY_MISCONFIGURATION" },
        ...over,
    };
}

function runResp(status: RunStatus, logs: AttackResult[] = []): GetRunResponse {
    return {
        summary: {
            id: "run-1",
            specUrl: baseOpts.spec,
            status,
            totalEndpoints: 1,
            totalAttacks: 5,
            completedAttacks: status === "COMPLETED" ? 5 : 2,
            overallScore: logs.some((l) => l.severity === "CRITICAL") ? 20 : 70,
            scoreLabel: "MEDIUM",
            severityBreakdown: { critical: 0, high: logs.filter((l) => l.severity === "HIGH").length, medium: 0, low: 0, info: 3 },
        },
        logs,
    };
}

function mockIO(nowSeq?: number[]) {
    const out: string[] = [];
    const err: string[] = [];
    const files: Record<string, string> = {};
    let i = 0;
    const io: ScanIO = {
        log: (m) => out.push(m),
        error: (m) => err.push(m),
        progress: (m) => err.push(m),
        writeFile: async (p, c) => {
            files[p] = c;
        },
        sleep: async () => {},
        now: () => (nowSeq ? nowSeq[Math.min(i++, nowSeq.length - 1)]! : 0),
    };
    return { io, out, err, files };
}

describe("runScan — happy path", () => {
    it("polls PARSING → ATTACKING → COMPLETED, then exits 1 on a HIGH finding (fail-on=high)", async () => {
        const api: OnyxApi = {
            createRun: vi.fn().mockResolvedValue({ testRunId: "run-1", status: "PARSING", message: "" }),
            getRun: vi
                .fn()
                .mockResolvedValueOnce(runResp("PARSING"))
                .mockResolvedValueOnce(runResp("ATTACKING"))
                .mockResolvedValueOnce(runResp("COMPLETED", [log("HIGH"), log("INFO")])),
        };
        const { io, out } = mockIO();
        const code = await runScan(baseOpts, api, io);

        expect(api.createRun).toHaveBeenCalledWith(baseOpts.spec, undefined);
        expect(api.getRun).toHaveBeenCalledTimes(3);
        expect(code).toBe(1); // a HIGH finding at fail-on=high
        expect(out.join("\n")).toContain("Findings (1)"); // INFO excluded
    });

    it("exits 0 when no finding meets the threshold", async () => {
        const api: OnyxApi = {
            createRun: vi.fn().mockResolvedValue({ testRunId: "run-1", status: "PARSING", message: "" }),
            getRun: vi.fn().mockResolvedValue(runResp("COMPLETED", [log("MEDIUM"), log("INFO")])),
        };
        const { io } = mockIO();
        expect(await runScan(baseOpts, api, io)).toBe(0); // MEDIUM < high
    });

    it("writes sarif to --out and still prints a table summary", async () => {
        const api: OnyxApi = {
            createRun: vi.fn().mockResolvedValue({ testRunId: "run-1", status: "PARSING", message: "" }),
            getRun: vi.fn().mockResolvedValue(runResp("COMPLETED", [log("CRITICAL")])),
        };
        const { io, out, files } = mockIO();
        const code = await runScan({ ...baseOpts, format: "sarif", out: "onyx.sarif", failOn: "critical" }, api, io);

        expect(code).toBe(1);
        expect(files["onyx.sarif"]).toContain('"version": "2.1.0"');
        expect(JSON.parse(files["onyx.sarif"]!).runs[0].results.length).toBe(1);
        expect(out.join("\n")).toContain("Onyx scan"); // table summary on stdout
    });
});

describe("runScan — failure paths (exit 2)", () => {
    it("FAILED run → exit 2 with a clear message", async () => {
        const api: OnyxApi = {
            createRun: vi.fn().mockResolvedValue({ testRunId: "run-1", status: "PARSING", message: "" }),
            getRun: vi.fn().mockResolvedValue(runResp("FAILED")),
        };
        const { io, err } = mockIO();
        const code = await runScan(baseOpts, api, io);
        expect(code).toBe(2);
        expect(err.join("\n")).toContain("FAILED");
    });

    it("401 on create → exit 2, token never echoed", async () => {
        const api: OnyxApi = {
            createRun: vi.fn().mockRejectedValue(new AuthError()),
            getRun: vi.fn(),
        };
        const { io, err } = mockIO();
        const code = await runScan(baseOpts, api, io);
        expect(code).toBe(2);
        const text = err.join("\n");
        expect(text).toContain("Authentication failed");
        expect(text).not.toContain(baseOpts.apiToken); // never leaks the token
    });

    it("timeout → exit 2 when the run never terminates", async () => {
        const api: OnyxApi = {
            createRun: vi.fn().mockResolvedValue({ testRunId: "run-1", status: "PARSING", message: "" }),
            getRun: vi.fn().mockResolvedValue(runResp("ATTACKING")),
        };
        // now(): start=0 → deadline=0+2*1000=2000; after first poll now=5000 ≥ 2000 → timeout.
        const { io, err } = mockIO([0, 5000, 5001]);
        const code = await runScan({ ...baseOpts, timeoutSeconds: 2 }, api, io);
        expect(code).toBe(2);
        expect(err.join("\n")).toContain("Timed out");
        expect(api.getRun).toHaveBeenCalledTimes(1);
    });
});
