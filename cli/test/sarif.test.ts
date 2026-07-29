// SARIF 2.1.0 shape + level mapping + locations.
import { describe, it, expect } from "vitest";
import { toSarif, severityToSarifLevel } from "../src/format/sarif.js";
import type { RunReport } from "../src/findings.js";
import type { NormalizedFinding } from "../src/types.js";

const finding = (over: Partial<NormalizedFinding>): NormalizedFinding => ({
    method: "GET",
    endpoint: "/users/{id}",
    statusCode: 500,
    severity: "HIGH",
    category: "SQL Injection",
    title: "DB error disclosed",
    owaspCode: "API8",
    owaspLabel: "API8:2023 Security Misconfiguration",
    owaspCategory: "API8_SECURITY_MISCONFIGURATION",
    ...over,
});

const report = (findings: NormalizedFinding[]): RunReport => ({
    runId: "run-1",
    specUrl: "https://api.example.com/openapi.json",
    status: "COMPLETED",
    overallScore: 40,
    scoreLabel: "HIGH",
    severityCounts: { critical: 1, high: 1, medium: 0, low: 0, info: 3 },
    findings,
});

describe("severityToSarifLevel", () => {
    it("maps severities to SARIF levels", () => {
        expect(severityToSarifLevel("CRITICAL")).toBe("error");
        expect(severityToSarifLevel("HIGH")).toBe("error");
        expect(severityToSarifLevel("MEDIUM")).toBe("warning");
        expect(severityToSarifLevel("LOW")).toBe("note");
        expect(severityToSarifLevel("INFO")).toBe("note");
    });
});

describe("toSarif — SARIF 2.1.0 shape", () => {
    it("emits a schema-shaped log with version, tool.driver, rules and results", () => {
        const sarif = toSarif(
            report([
                finding({ severity: "CRITICAL", category: "Sensitive Data Exposure", title: "Secret leak", owaspCode: "API3" }),
                finding({ severity: "HIGH", category: "SQL Injection" }),
                finding({ severity: "MEDIUM", category: "SQL Injection", title: "Blind" }),
            ]),
        );

        expect(sarif.version).toBe("2.1.0");
        expect(sarif.$schema).toMatch(/sarif-2\.1\.0\.json$/);
        expect(sarif.runs).toHaveLength(1);

        const run = sarif.runs[0]!;
        expect(run.tool.driver.name).toBe("Onyx");
        expect(run.tool.driver.version).toBeTruthy();

        // One rule per distinct category (2 categories here).
        const ruleIds = run.tool.driver.rules.map((r) => r.id);
        expect(new Set(ruleIds).size).toBe(ruleIds.length); // unique
        expect(run.tool.driver.rules).toHaveLength(2);
        for (const rule of run.tool.driver.rules) {
            expect(rule.id).toMatch(/^onyx\//);
            expect(rule.shortDescription.text).toBeTruthy();
        }

        // One result per finding, well-formed.
        expect(run.results).toHaveLength(3);
        for (const res of run.results) {
            expect(res.ruleId).toBeTruthy();
            expect(["error", "warning", "note"]).toContain(res.level);
            expect(res.message.text).toBeTruthy();
            // ruleIndex points at a real rule with the same id.
            expect(run.tool.driver.rules[res.ruleIndex]!.id).toBe(res.ruleId);
            // Location set to the endpoint (a valid relative-reference URI).
            const loc = res.locations[0]!;
            expect(loc.physicalLocation.artifactLocation.uri).toBe("/users/{id}");
            expect(loc.logicalLocations[0]!.name).toContain("GET");
        }

        // Level mapping applied per finding.
        expect(run.results[0]!.level).toBe("error"); // CRITICAL
        expect(run.results[1]!.level).toBe("error"); // HIGH
        expect(run.results[2]!.level).toBe("warning"); // MEDIUM
    });

    it("no findings → an empty-but-valid results array", () => {
        const sarif = toSarif(report([]));
        expect(sarif.version).toBe("2.1.0");
        expect(sarif.runs[0]!.results).toEqual([]);
        expect(sarif.runs[0]!.tool.driver.rules).toEqual([]);
    });

    it("serializes to valid JSON", () => {
        const json = JSON.stringify(toSarif(report([finding({})])));
        expect(() => JSON.parse(json)).not.toThrow();
    });
});
