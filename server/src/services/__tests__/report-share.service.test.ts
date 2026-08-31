// =============================================================================
// Tests for the report-share service (T16a) — token generation, URL building,
// and the token-resolution contract. Prisma is mocked, so no live DB.
// =============================================================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const findFirst = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();

vi.mock("../../lib/prisma.js", () => ({
    prisma: {
        reportShare: {
            findFirst: (...a: unknown[]) => findFirst(...a),
            create: (...a: unknown[]) => create(...a),
            updateMany: (...a: unknown[]) => updateMany(...a),
        },
    },
}));

const {
    generateShareToken,
    buildShareUrl,
    createOrGetShare,
    getActiveShare,
    revokeShares,
    resolveShareToken,
} = await import("../report-share.service.js");

beforeEach(() => {
    findFirst.mockReset();
    create.mockReset();
    updateMany.mockReset();
    delete process.env.SHARE_BASE_URL;
    delete process.env.APP_BASE_URL;
});
afterEach(() => {
    delete process.env.SHARE_BASE_URL;
    delete process.env.APP_BASE_URL;
});

describe("generateShareToken — non-enumerable", () => {
    it("is 43 base62 chars (~256 bits)", () => {
        const t = generateShareToken();
        expect(t).toHaveLength(43);
        expect(t).toMatch(/^[0-9a-zA-Z]{43}$/);
    });
    it("is unique across many draws", () => {
        const set = new Set(Array.from({ length: 500 }, () => generateShareToken()));
        expect(set.size).toBe(500);
    });
});

describe("buildShareUrl", () => {
    it("prefers SHARE_BASE_URL", () => {
        process.env.SHARE_BASE_URL = "https://onyx.example.com/";
        expect(buildShareUrl("tok")).toBe("https://onyx.example.com/shared/tok");
    });
    it("falls back to APP_BASE_URL, then the request origin", () => {
        process.env.APP_BASE_URL = "https://app.example.com";
        expect(buildShareUrl("tok")).toBe("https://app.example.com/shared/tok");
        delete process.env.APP_BASE_URL;
        expect(buildShareUrl("tok", "https://req.example.com")).toBe(
            "https://req.example.com/shared/tok",
        );
    });
});

describe("createOrGetShare — idempotent", () => {
    it("returns the EXISTING active share instead of minting a second", async () => {
        const existing = { id: "s1", testRunId: "r1", token: "tok1", createdAt: new Date(), revokedAt: null };
        findFirst.mockResolvedValue(existing);

        const got = await createOrGetShare({ testRunId: "r1" });
        expect(got).toBe(existing);
        expect(create).not.toHaveBeenCalled(); // no second token
    });

    it("creates a share when none is active", async () => {
        findFirst.mockResolvedValue(null);
        create.mockImplementation(async ({ data }: { data: { token: string } }) => ({
            id: "s2", testRunId: "r1", token: data.token, createdAt: new Date(), revokedAt: null,
        }));

        const got = await createOrGetShare({ testRunId: "r1", createdByUserId: "u1" });
        expect(create).toHaveBeenCalledTimes(1);
        expect(got.token).toMatch(/^[0-9a-zA-Z]{43}$/);
    });
});

describe("revoke + resolve", () => {
    it("revokeShares revokes all active shares for the run", async () => {
        updateMany.mockResolvedValue({ count: 1 });
        expect(await revokeShares("r1")).toBe(1);
        const arg = updateMany.mock.calls[0]![0] as { where: Record<string, unknown> };
        expect(arg.where).toMatchObject({ testRunId: "r1", revokedAt: null });
    });

    it("resolveShareToken returns the run id for a live token", async () => {
        findFirst.mockResolvedValue({ testRunId: "r1" });
        expect(await resolveShareToken("a".repeat(43))).toBe("r1");
        // only NON-revoked rows are considered
        const arg = findFirst.mock.calls[0]![0] as { where: Record<string, unknown> };
        expect(arg.where).toMatchObject({ revokedAt: null });
    });

    it("returns null for unknown AND revoked tokens (both 404 upstream)", async () => {
        findFirst.mockResolvedValue(null);
        expect(await resolveShareToken("b".repeat(43))).toBeNull();
    });

    it("rejects implausible token lengths without touching the DB", async () => {
        expect(await resolveShareToken("short")).toBeNull();
        expect(await resolveShareToken("x".repeat(500))).toBeNull();
        expect(await resolveShareToken("")).toBeNull();
        expect(findFirst).not.toHaveBeenCalled();
    });

    it("getActiveShare only looks for non-revoked shares", async () => {
        findFirst.mockResolvedValue(null);
        await getActiveShare("r1");
        const arg = findFirst.mock.calls[0]![0] as { where: Record<string, unknown> };
        expect(arg.where).toMatchObject({ testRunId: "r1", revokedAt: null });
    });
});
