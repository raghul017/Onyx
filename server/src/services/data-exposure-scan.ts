// =============================================================================
// Excessive-data-exposure scan pass (T14c) — analyzes responses the scan ALREADY
// collected and records AT MOST ONE finding per endpoint.
//
// Source of the response, in order:
//   1. The endpoint's BASELINE (T5) — one benign 2xx per endpoint, so dedupe is
//      structural (the table is unique on testRunId+endpointId).
//   2. FALLBACK when there's no baseline (e.g. FREE plan skips baseline capture):
//      ONE representative 2xx AttackLog for that endpoint.
// Either way we analyze a single response per endpoint, so an endpoint can never
// produce one finding per payload.
//
// No new HTTP traffic. Snippets are already T3-redacted when stored, so evidence
// never contains a raw secret value.
//
// The finding is written as its own AttackLog row with findingJson (like BOLA/
// BFLA/mass-assignment), so it surfaces exactly once through the existing
// resolveFinding read path, scoring, and PDF/OWASP coverage.
// =============================================================================

import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import {
    analyzeResponseExposure,
    decideExposureVerdict,
    type ExposureJudge,
} from "./data-exposure.js";

const log = logger.child({ component: "data-exposure" });

/** One response to analyze, already resolved to a single row per endpoint. */
interface EndpointResponse {
    endpointId: string;
    method: string;
    path: string;
    statusCode: number;
    bodySnippet: string;
}

export interface ExposureScanDeps {
    /** Injected for tests; defaults to the real DB reads/writes. */
    loadResponses?: (testRunId: string) => Promise<EndpointResponse[]>;
    saveFinding?: (row: {
        testRunId: string;
        endpointId: string;
        method: string;
        path: string;
        statusCode: number;
        bodySnippet: string;
        finding: unknown;
    }) => Promise<void>;
    judge?: ExposureJudge;
}

/**
 * Load ONE response per endpoint: the baseline when present, else a
 * representative 2xx attack response. Never returns two rows for one endpoint.
 */
async function loadResponsesFromDb(testRunId: string): Promise<EndpointResponse[]> {
    const endpoints = await prisma.targetEndpoint.findMany({
        where: { testRunId },
        select: { id: true, method: true, path: true },
    });
    if (endpoints.length === 0) return [];

    const baselines = await prisma.baselineResponse.findMany({
        where: { testRunId },
        select: { endpointId: true, status: true, bodySnippet: true },
    });
    const baselineBy = new Map(baselines.map((b) => [b.endpointId, b]));

    const out: EndpointResponse[] = [];
    for (const ep of endpoints) {
        const b = baselineBy.get(ep.id);
        if (b && b.status != null && b.bodySnippet) {
            out.push({
                endpointId: ep.id,
                method: ep.method,
                path: ep.path,
                statusCode: b.status,
                bodySnippet: b.bodySnippet,
            });
            continue;
        }
        // Fallback: one representative 2xx JSON attack response for this endpoint.
        const log2xx = await prisma.attackLog.findFirst({
            where: {
                testRunId,
                endpointId: ep.id,
                statusCode: { gte: 200, lt: 300 },
                responseSnippet: { not: null },
            },
            orderBy: { createdAt: "asc" },
            select: { statusCode: true, responseSnippet: true },
        });
        if (log2xx?.statusCode != null && log2xx.responseSnippet) {
            out.push({
                endpointId: ep.id,
                method: ep.method,
                path: ep.path,
                statusCode: log2xx.statusCode,
                bodySnippet: log2xx.responseSnippet,
            });
        }
    }
    return out;
}

async function saveFindingToDb(row: {
    testRunId: string;
    endpointId: string;
    method: string;
    path: string;
    statusCode: number;
    bodySnippet: string;
    finding: unknown;
}): Promise<void> {
    await prisma.attackLog.create({
        data: {
            testRunId: row.testRunId,
            endpointId: row.endpointId,
            method: row.method,
            path: row.path,
            payload: "", // analysis-only: no request was sent for this finding
            statusCode: row.statusCode,
            latencyMs: 0,
            responseSnippet: row.bodySnippet,
            attackType: "DATA_EXPOSURE",
            owaspCategory: "API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION",
            findingJson: row.finding as object,
        },
    });
}

/**
 * Run the exposure pass for a completed run. Returns the number of findings
 * recorded (0 when nothing qualifies). Never throws — a failure here must never
 * affect the run. Analysis only: no attack traffic, no counter changes, so the
 * completion gate is unaffected.
 */
export async function scanForDataExposure(
    testRunId: string,
    deps: ExposureScanDeps = {},
): Promise<number> {
    const loadResponses = deps.loadResponses ?? loadResponsesFromDb;
    const saveFinding = deps.saveFinding ?? saveFindingToDb;

    try {
        const responses = await loadResponses(testRunId);
        let recorded = 0;

        for (const r of responses) {
            const analysis = analyzeResponseExposure(r.statusCode, r.bodySnippet);
            if (analysis.fields.length === 0) continue;

            const finding = await decideExposureVerdict(
                {
                    method: r.method,
                    path: r.path,
                    statusCode: r.statusCode,
                    bodySnippet: r.bodySnippet,
                },
                analysis,
                deps.judge,
            );
            if (!finding) continue;

            await saveFinding({
                testRunId,
                endpointId: r.endpointId,
                method: r.method,
                path: r.path,
                statusCode: r.statusCode,
                bodySnippet: r.bodySnippet,
                finding,
            });
            recorded++;
        }

        if (recorded > 0) {
            log.info({ testRunId, count: recorded }, "Recorded data-exposure findings");
        }
        return recorded;
    } catch (err) {
        log.error(
            { testRunId, err: err instanceof Error ? err.message : String(err) },
            "Data-exposure scan failed",
        );
        return 0;
    }
}
