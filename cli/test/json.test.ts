// JSON formatter — stable shape.
import { describe, it, expect } from "vitest";
import { toJsonReport } from "../src/format/json.js";
import type { RunReport } from "../src/findings.js";

const report: RunReport = {
    runId: "run-9",
    specUrl: "https://api.example.com/openapi.json",
    status: "COMPLETED",
    overallScore: 55,
    scoreLabel: "MEDIUM",
    severityCounts: { critical: 0, high: 1, medium: 1, low: 2, info: 10 },
    findings: [
        { method: "POST", endpoint: "/login", statusCode: 200, severity: "HIGH", category: "Broken Authentication / Access Control", title: "Auth bypass", owaspCode: "API2", owaspLabel: "API2:2023 Broken Authentication", owaspCategory: "API2_BROKEN_AUTHENTICATION" },
        { method: "GET", endpoint: "/search", statusCode: 500, severity: "MEDIUM", category: "SQL Injection", title: "Blind", owaspCode: "API8", owaspLabel: "API8:2023 Security Misconfiguration", owaspCategory: "API8_SECURITY_MISCONFIGURATION" },
    ],
};

describe("toJsonReport — stable shape", () => {
    it("has the documented top-level fields", () => {
        const j = toJsonReport(report);
        expect(j).toMatchObject({
            onyxCliVersion: expect.any(String),
            runId: "run-9",
            specUrl: report.specUrl,
            status: "COMPLETED",
            score: 55,
            scoreLabel: "MEDIUM",
            findingCount: 2,
        });
        expect(j.severityCounts).toEqual(report.severityCounts);
        expect(j.owaspCoverage).toEqual({ API2: 1, API8: 1 });
    });

    it("each finding carries method/endpoint/severity/owasp", () => {
        const j = toJsonReport(report);
        expect(j.findings[0]).toEqual({
            method: "POST",
            endpoint: "/login",
            statusCode: 200,
            severity: "HIGH",
            category: "Broken Authentication / Access Control",
            title: "Auth bypass",
            owaspCode: "API2",
            owaspLabel: "API2:2023 Broken Authentication",
        });
    });
});
