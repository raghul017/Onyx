// =============================================================================
// Tests for the report-share endpoints (T16a): auth + ownership on the owner
// routes, no-auth on the public route, revoked/unknown => 404, and the crucial
// assertion that the public payload carries NO secrets or sharer identity.
// Prisma + the share service are mocked — no live DB.
// =============================================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const testRunFindUnique = vi.fn();
const createOrGetShare = vi.fn();
const getActiveShare = vi.fn();
const revokeShares = vi.fn();
const resolveShareToken = vi.fn();

vi.mock("../../lib/prisma.js", () => ({
    prisma: { testRun: { findUnique: (...a: unknown[]) => testRunFindUnique(...a) } },
}));
vi.mock("../../services/report-share.service.js", () => ({
    createOrGetShare: (...a: unknown[]) => createOrGetShare(...a),
    getActiveShare: (...a: unknown[]) => getActiveShare(...a),
    revokeShares: (...a: unknown[]) => revokeShares(...a),
    resolveShareToken: (...a: unknown[]) => resolveShareToken(...a),
    buildShareUrl: (token: string) => `https://onyx.test/shared/${token}`,
}));

const { createShare, getShare, revokeShare, getSharedReport } = await import(
    "../report-share.controller.js"
);

const OWNER = "user-1";
const run = { id: "run-1", userId: OWNER, orgId: null };

function mockRes() {
    const res = {
        statusCode: 200,
        body: undefined as unknown,
        status(c: number) { this.statusCode = c; return this; },
        json(b: unknown) { this.body = b; return this; },
    };
    return res as unknown as Response & { statusCode: number; body: any };
}
const req = (over: Partial<Request> = {}): Request =>
    ({ params: {}, headers: {}, get: () => "onyx.test", ...over }) as unknown as Request;

const next = vi.fn();

beforeEach(() => {
    [testRunFindUnique, createOrGetShare, getActiveShare, revokeShares, resolveShareToken, next]
        .forEach((m) => m.mockReset());
});

describe("owner routes — auth + ownership enforced", () => {
    it("createShare returns the token + URL for the owner", async () => {
        testRunFindUnique.mockResolvedValue(run);
        createOrGetShare.mockResolvedValue({
            id: "s1", testRunId: "run-1", token: "TOK", createdAt: new Date(), revokedAt: null,
        });
        const res = mockRes();
        await createShare(req({ params: { id: "run-1" } as any, user: { id: OWNER } } as any), res, next);
        expect(res.statusCode).toBe(201);
        expect(res.body.token).toBe("TOK");
        expect(res.body.url).toBe("https://onyx.test/shared/TOK");
    });

    it("a NON-owner is rejected with 403", async () => {
        testRunFindUnique.mockResolvedValue(run);
        const res = mockRes();
        await createShare(
            req({ params: { id: "run-1" } as any, user: { id: "someone-else" } } as any),
            res, next,
        );
        expect(res.statusCode).toBe(403);
        expect(createOrGetShare).not.toHaveBeenCalled();
    });

    it("an unauthenticated caller (no req.user) is rejected", async () => {
        testRunFindUnique.mockResolvedValue(run);
        const res = mockRes();
        await createShare(req({ params: { id: "run-1" } as any }), res, next);
        expect(res.statusCode).toBe(403);
    });

    it("an org member of the owning org may share", async () => {
        testRunFindUnique.mockResolvedValue({ id: "run-2", userId: null, orgId: "org-1" });
        createOrGetShare.mockResolvedValue({
            id: "s2", testRunId: "run-2", token: "T2", createdAt: new Date(), revokedAt: null,
        });
        const res = mockRes();
        await createShare(
            req({ params: { id: "run-2" } as any, user: { id: "u9" }, orgId: "org-1" } as any),
            res, next,
        );
        expect(res.statusCode).toBe(201);
    });

    it("a missing run 404s", async () => {
        testRunFindUnique.mockResolvedValue(null);
        const res = mockRes();
        await createShare(req({ params: { id: "nope" } as any, user: { id: OWNER } } as any), res, next);
        expect(res.statusCode).toBe(404);
    });

    it("getShare reports status; revokeShare revokes (owner only)", async () => {
        testRunFindUnique.mockResolvedValue(run);
        getActiveShare.mockResolvedValue(null);
        const r1 = mockRes();
        await getShare(req({ params: { id: "run-1" } as any, user: { id: OWNER } } as any), r1, next);
        expect(r1.body).toEqual({ shared: false });

        revokeShares.mockResolvedValue(1);
        const r2 = mockRes();
        await revokeShare(req({ params: { id: "run-1" } as any, user: { id: OWNER } } as any), r2, next);
        expect(r2.body).toEqual({ revoked: 1 });

        // non-owner cannot revoke
        const r3 = mockRes();
        await revokeShare(req({ params: { id: "run-1" } as any, user: { id: "x" } } as any), r3, next);
        expect(r3.statusCode).toBe(403);
    });
});

describe("public route — no auth required", () => {
    const sharedRun = {
        id: "run-1",
        specUrl: "https://api.example.com/openapi.json",
        status: "COMPLETED",
        totalEndpoints: 2,
        totalAttacks: 3,
        completedAttacks: 3,
        createdAt: new Date(),
        completedAt: new Date(),
        // Fields that must NEVER reach the public payload:
        userId: "user-1",
        orgId: "org-1",
        authRecipeId: "recipe-secret-1",
        logs: [
            {
                id: "l1", testRunId: "run-1", method: "GET", path: "/users",
                statusCode: 200, latencyMs: 10, payload: "", responseSnippet: '{"ok":true}',
                attackType: "SQL_INJECTION", createdAt: new Date(),
            },
        ],
    };

    it("returns the report payload for a valid token WITHOUT any auth", async () => {
        resolveShareToken.mockResolvedValue("run-1");
        testRunFindUnique.mockResolvedValue(sharedRun);
        const res = mockRes();
        // NOTE: no user / no orgId on the request at all.
        await getSharedReport(req({ params: { token: "TOK" } as any }), res, next);

        expect(res.statusCode).toBe(200);
        expect(res.body.summary.id).toBe("run-1");
        expect(res.body.summary).toHaveProperty("overallScore");
        expect(res.body.summary).toHaveProperty("severityBreakdown");
        expect(res.body.logs).toHaveLength(1);
        expect(res.body.logs[0]).toHaveProperty("finding"); // findings included
    });

    it("EXCLUDES secrets, credentials, and the sharer's identity", async () => {
        resolveShareToken.mockResolvedValue("run-1");
        testRunFindUnique.mockResolvedValue(sharedRun);
        const res = mockRes();
        await getSharedReport(req({ params: { token: "TOK" } as any }), res, next);

        const serialized = JSON.stringify(res.body);
        expect(serialized).not.toContain("recipe-secret-1"); // no auth recipe
        expect(serialized).not.toContain("org-1"); // no org identity
        expect(serialized).not.toContain("user-1"); // no sharer identity
        expect(res.body.summary).not.toHaveProperty("userId");
        expect(res.body.summary).not.toHaveProperty("orgId");
        expect(res.body.summary).not.toHaveProperty("authRecipeId");
        expect(res.body).not.toHaveProperty("share");
    });

    it("unknown token => 404", async () => {
        resolveShareToken.mockResolvedValue(null);
        const res = mockRes();
        await getSharedReport(req({ params: { token: "nope" } as any }), res, next);
        expect(res.statusCode).toBe(404);
        expect(testRunFindUnique).not.toHaveBeenCalled();
    });

    it("revoked token => 404 (service returns null for revoked)", async () => {
        resolveShareToken.mockResolvedValue(null); // revoked resolves to null
        const res = mockRes();
        await getSharedReport(req({ params: { token: "REVOKED" } as any }), res, next);
        expect(res.statusCode).toBe(404);
    });

    it("a deleted run behind a live token => 404", async () => {
        resolveShareToken.mockResolvedValue("run-1");
        testRunFindUnique.mockResolvedValue(null);
        const res = mockRes();
        await getSharedReport(req({ params: { token: "TOK" } as any }), res, next);
        expect(res.statusCode).toBe(404);
    });
});
