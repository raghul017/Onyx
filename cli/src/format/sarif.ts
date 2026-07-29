// =============================================================================
// SARIF 2.1.0 formatter. One rule per distinct finding category; one result per
// finding with a level mapped from severity and a location set to the endpoint.
//
// Level mapping: CRITICAL/HIGH => error, MEDIUM => warning, LOW/INFO => note.
// =============================================================================

import type { NormalizedFinding, Severity } from "../types.js";
import type { RunReport } from "../findings.js";
import { CLI_VERSION } from "../version.js";

export type SarifLevel = "error" | "warning" | "note";

export function severityToSarifLevel(sev: Severity): SarifLevel {
    switch (sev) {
        case "CRITICAL":
        case "HIGH":
            return "error";
        case "MEDIUM":
            return "warning";
        default:
            return "note"; // LOW / INFO
    }
}

/** Stable rule id from a category name (SARIF ruleId must be stable + opaque). */
function ruleIdFor(category: string): string {
    return (
        "onyx/" +
        category
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
    );
}

export interface SarifLog {
    $schema: string;
    version: "2.1.0";
    runs: Array<{
        tool: {
            driver: {
                name: string;
                informationUri: string;
                version: string;
                rules: Array<{
                    id: string;
                    name: string;
                    shortDescription: { text: string };
                    properties?: Record<string, unknown>;
                }>;
            };
        };
        results: Array<{
            ruleId: string;
            ruleIndex: number;
            level: SarifLevel;
            message: { text: string };
            locations: Array<{
                physicalLocation: { artifactLocation: { uri: string } };
                logicalLocations: Array<{ name: string; kind: string }>;
            }>;
            properties: Record<string, unknown>;
        }>;
    }>;
}

export function toSarif(report: RunReport): SarifLog {
    const findings: NormalizedFinding[] = report.findings;

    // One rule per distinct category, preserving first-seen order → ruleIndex.
    const ruleIndexByCategory = new Map<string, number>();
    const rules: SarifLog["runs"][0]["tool"]["driver"]["rules"] = [];
    for (const f of findings) {
        if (!ruleIndexByCategory.has(f.category)) {
            ruleIndexByCategory.set(f.category, rules.length);
            rules.push({
                id: ruleIdFor(f.category),
                name: f.category.replace(/[^A-Za-z0-9]+/g, ""),
                shortDescription: { text: f.category },
                properties: { owasp: f.owaspLabel, owaspCode: f.owaspCode },
            });
        }
    }

    const results = findings.map((f) => {
        const ruleIndex = ruleIndexByCategory.get(f.category)!;
        return {
            ruleId: rules[ruleIndex]!.id,
            ruleIndex,
            level: severityToSarifLevel(f.severity),
            message: {
                text: `${f.severity} — ${f.title} (${f.method} ${f.endpoint})`,
            },
            locations: [
                {
                    // The endpoint path is a valid relative-reference URI.
                    physicalLocation: { artifactLocation: { uri: f.endpoint || "/" } },
                    logicalLocations: [{ name: `${f.method} ${f.endpoint}`, kind: "member" }],
                },
            ],
            properties: {
                severity: f.severity,
                httpMethod: f.method,
                endpoint: f.endpoint,
                statusCode: f.statusCode,
                owasp: f.owaspLabel,
                owaspCode: f.owaspCode,
            },
        };
    });

    return {
        $schema: "https://json.schemastore.org/sarif-2.1.0.json",
        version: "2.1.0",
        runs: [
            {
                tool: {
                    driver: {
                        name: "Onyx",
                        informationUri: "https://github.com/onyx-security/onyx",
                        version: CLI_VERSION,
                        rules,
                    },
                },
                results,
            },
        ],
    };
}

export function renderSarif(report: RunReport): string {
    return JSON.stringify(toSarif(report), null, 2);
}
