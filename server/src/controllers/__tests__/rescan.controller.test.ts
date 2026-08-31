// =============================================================================
// Tests for the re-scan endpoint (T15b): auth + ownership, and that the log must
// belong to the run being addressed. Prisma + the service are mocked.
// =============================================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const testRunFindUnique = vi.fn();
const attackLogFindFirst = vi.fn();
const rescanFinding = vi.fn();

vi.mock("../../lib/prisma.js", () => ({
    prisma: {
        testRun: { findUnique: (...a: unknown[]) => testRunFindUnique(...a) },
        attackLog: { findFirst: (...a: unknown[]) => attackLogFindFirst(...a) },
    },
}));
vi.mock("../../services/rescan.service.js", () => ({
    rescanFinding: (...a: unknown[]) => rescanFinding(...a),
}));

const { rescanFindingHandler } = await import("../rescan.controller.js");

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
    ({ params: { id: "run-1", logId: "log-1" }, headers: {}, ...over }) as unknown as Request;
const next = vi.fn();

beforeEach(() => {
    [testRunFindUnique, attackLogFindFirst, rescanFinding, next].forEach((m) => m.mockReset());
});

describe("rescan endpoint — auth + ownership", () => {
    it("the owner gets the rescan result", async () => {
        testRunFindUnique.mockResolvedValue(run);
        attackLogFindFirst.mockResolvedValue({ id: "log-1" });
        rescanFinding.mockResolvedValue({
            outcome: "resolved", resolved: true, checkedAt: "now", severity: null,
            category: null, message: "ok",
        });

        const res = mockRes();
        await rescanFindingHandler(req({ user: { id: OWNER } } as any), res, next);
        expect(res.statusCode).toBe(200);
        expect(res.body.resolved).toBe(true);
        expect(rescanFinding).toHaveBeenCalledWith("log-1");
    });

    it("a NON-owner is rejected 403 and no rescan fires", async () => {
        testRunFindUnique.mockResolvedValue(run);
        const res = mockRes();
        await rescanFindingHandler(req({ user: { id: "someone-else" } } as any), res, next);
        expect(res.statusCode).toBe(403);
        expect(rescanFinding).not.toHaveBeenCalled();
    });

    it("an unauthenticated caller is rejected", async () => {
        testRunFindUnique.mockResolvedValue(run);
        const res = mockRes();
        await rescanFindingHandler(req(), res, next);
        expect(res.statusCode).toBe(403);
        expect(rescanFinding).not.toHaveBeenCalled();
    });

    it("an org member of the owning org may rescan", async () => {
        testRunFindUnique.mockResolvedValue({ id: "run-2", userId: null, orgId: "org-1" });
        attackLogFindFirst.mockResolvedValue({ id: "log-1" });
        rescanFinding.mockResolvedValue({ outcome: "still_present", resolved: false });
        const res = mockRes();
        await rescanFindingHandler(
            req({ params: { id: "run-2", logId: "log-1" }, user: { id: "u9" }, orgId: "org-1" } as any),
            res, next,
        );
        expect(res.statusCode).toBe(200);
    });

    it("a missing run 404s", async () => {
        testRunFindUnique.mockResolvedValue(null);
        const res = mockRes();
        await rescanFindingHandler(req({ user: { id: OWNER } } as any), res, next);
        expect(res.statusCode).toBe(404);
        expect(rescanFinding).not.toHaveBeenCalled();
    });

    it("a log belonging to ANOTHER run 404s (can't re-fire across runs)", async () => {
        testRunFindUnique.mockResolvedValue(run);
        attackLogFindFirst.mockResolvedValue(null); // not found *for this run*
        const res = mockRes();
        await rescanFindingHandler(req({ user: { id: OWNER } } as any), res, next);
        expect(res.statusCode).toBe(404);
        expect(rescanFinding).not.toHaveBeenCalled();
        // the lookup is scoped by BOTH ids
        expect(attackLogFindFirst.mock.calls[0]![0].where).toMatchObject({
            id: "log-1", testRunId: "run-1",
        });
    });

    it("an 'unsupported' outcome is returned as 200, not an error", async () => {
        testRunFindUnique.mockResolvedValue(run);
        attackLogFindFirst.mockResolvedValue({ id: "log-1" });
        rescanFinding.mockResolvedValue({
            outcome: "unsupported", resolved: false, message: "not supported yet",
        });
        const res = mockRes();
        await rescanFindingHandler(req({ user: { id: OWNER } } as any), res, next);
        expect(res.statusCode).toBe(200);
        expect(res.body.outcome).toBe("unsupported");
    });
});
