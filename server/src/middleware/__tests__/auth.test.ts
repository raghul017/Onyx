// =============================================================================
// Tests for authenticateToken (T10a) — API-token path + JWT fallthrough, and the
// requireSessionAuth guard. Prisma is mocked; JWTs are real (HS256).
// =============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

// auth.ts reads JWT_SECRET at import time (process.exit(1) if unset) — set it
// before the module loads via a hoisted block.
vi.hoisted(() => {
    process.env.JWT_SECRET = "test-jwt-secret-abcdef";
});

const { findUnique, update } = vi.hoisted(() => ({
    findUnique: vi.fn(),
    update: vi.fn(),
}));
vi.mock("../../lib/prisma.js", () => ({
    prisma: { apiToken: { findUnique, update } },
}));

import { authenticateToken, requireSessionAuth } from "../auth.js";
import { hashApiToken } from "../../services/api-token.service.js";

function mockRes() {
    const res: Partial<Response> & { statusCode?: number } = {};
    res.status = vi.fn().mockReturnValue(res) as any;
    res.json = vi.fn().mockReturnValue(res) as any;
    return res as Response;
}
const reqWith = (authorization?: string): Request =>
    ({ headers: authorization ? { authorization } : {} }) as unknown as Request;

beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    update.mockResolvedValue({});
});

describe("authenticateToken — API token path", () => {
    it("authenticates a valid token: sets req.user + authMethod, looks up by hash", async () => {
        findUnique.mockResolvedValue({
            id: "t1", userId: "u1", orgId: null, revokedAt: null, lastUsedAt: null,
            user: { id: "u1", email: "u1@example.com" },
        });
        const req = reqWith("Bearer onyx_secret123");
        const next = vi.fn();
        await authenticateToken(req, mockRes(), next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.user).toEqual({ id: "u1", email: "u1@example.com" });
        expect(req.authMethod).toBe("apiToken");
        expect(findUnique).toHaveBeenCalledWith(
            expect.objectContaining({ where: { tokenHash: hashApiToken("onyx_secret123") } }),
        );
        // lastUsedAt was null → throttled bump fires.
        expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "t1" } }));
    });

    it("pins req.orgId for an org-scoped token", async () => {
        findUnique.mockResolvedValue({
            id: "t2", userId: "u1", orgId: "org9", revokedAt: null, lastUsedAt: new Date(),
            user: { id: "u1", email: "u1@example.com" },
        });
        const req = reqWith("Bearer onyx_org_scoped");
        const next = vi.fn();
        await authenticateToken(req, mockRes(), next);
        expect(req.orgId).toBe("org9");
        // lastUsedAt fresh → no bump.
        expect(update).not.toHaveBeenCalled();
    });

    it("rejects a revoked token with 401", async () => {
        findUnique.mockResolvedValue({
            id: "t3", userId: "u1", orgId: null, revokedAt: new Date(), lastUsedAt: null,
            user: { id: "u1", email: "u1@example.com" },
        });
        const req = reqWith("Bearer onyx_revoked");
        const res = mockRes();
        const next = vi.fn();
        await authenticateToken(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it("rejects an unknown token with 401", async () => {
        findUnique.mockResolvedValue(null);
        const req = reqWith("Bearer onyx_unknown");
        const res = mockRes();
        const next = vi.fn();
        await authenticateToken(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });
});

describe("authenticateToken — JWT path still works", () => {
    it("verifies a valid HS256 JWT and sets authMethod=jwt", async () => {
        const jwtToken = jwt.sign(
            { id: "u2", email: "u2@example.com" },
            process.env.JWT_SECRET!,
            { algorithm: "HS256" },
        );
        const req = reqWith(`Bearer ${jwtToken}`);
        const next = vi.fn();
        await authenticateToken(req, mockRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(req.user?.id).toBe("u2");
        expect(req.authMethod).toBe("jwt");
        expect(findUnique).not.toHaveBeenCalled(); // not the token path
    });

    it("rejects a tampered/invalid JWT with 403", async () => {
        const req = reqWith("Bearer not.a.valid.jwt");
        const res = mockRes();
        const next = vi.fn();
        await authenticateToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it("rejects a missing token with 401", async () => {
        const req = reqWith(undefined);
        const res = mockRes();
        const next = vi.fn();
        await authenticateToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
    });
});

describe("requireSessionAuth", () => {
    it("blocks API-token callers (403)", () => {
        const req = { authMethod: "apiToken" } as unknown as Request;
        const res = mockRes();
        const next = vi.fn();
        requireSessionAuth(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
    it("allows JWT session callers", () => {
        const req = { authMethod: "jwt" } as unknown as Request;
        const next = vi.fn();
        requireSessionAuth(req, mockRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
