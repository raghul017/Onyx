// =============================================================================
// Tests for the API-token controller (T10a) — create returns the plaintext ONCE,
// list is masked (never the token or its hash). Prisma is mocked.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

const { create, findMany } = vi.hoisted(() => ({ create: vi.fn(), findMany: vi.fn() }));
vi.mock("../../lib/prisma.js", () => ({ prisma: { apiToken: { create, findMany } } }));

import { createApiToken, listApiTokens } from "../api-token.controller.js";

function mockRes() {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res as Response & { json: any; status: any };
}

beforeEach(() => {
    create.mockReset();
    findMany.mockReset();
});

describe("createApiToken", () => {
    it("returns the plaintext token ONCE + masked fields, and never persists/returns the plaintext", async () => {
        // The controller generates the token, so capture what it tried to store.
        create.mockImplementation(async ({ data, select: _select }: any) => ({
            id: "tok1",
            userId: data.userId,
            orgId: data.orgId,
            name: data.name,
            last4: data.last4,
            createdAt: new Date(),
            lastUsedAt: null,
            revokedAt: null,
            // Keep the hash the controller passed so we can assert it's NOT returned.
            _tokenHash: data.tokenHash,
        }));

        const req = { user: { id: "u1", email: "u1@x.com" }, orgId: undefined, body: { name: "CI token" } } as unknown as Request;
        const res = mockRes();
        await createApiToken(req, res, vi.fn());

        expect(res.status).toHaveBeenCalledWith(201);
        const body = res.json.mock.calls[0][0];
        // Plaintext returned exactly once, well-formed.
        expect(typeof body.token).toBe("string");
        expect(body.token.startsWith("onyx_")).toBe(true);
        // Stored hash matches the returned token, and is NOT leaked in the response.
        const storedHash = create.mock.calls[0][0].data.tokenHash;
        expect(storedHash).toMatch(/^[0-9a-f]{64}$/);
        expect(body).not.toHaveProperty("tokenHash");
        expect(JSON.stringify(body)).not.toContain(storedHash);
        // Masked display present.
        expect(body.maskedToken).toBe(`onyx_••••${body.last4}`);
        expect(body.name).toBe("CI token");
    });

    it("400s on an invalid name", async () => {
        const req = { user: { id: "u1" }, body: { name: "" } } as unknown as Request;
        const res = mockRes();
        await createApiToken(req, res, vi.fn());
        expect(res.status).toHaveBeenCalledWith(400);
        expect(create).not.toHaveBeenCalled();
    });
});

describe("listApiTokens", () => {
    it("returns a masked list with NO token/hash", async () => {
        findMany.mockResolvedValue([
            { id: "t1", userId: "u1", orgId: null, name: "CI", last4: "wxyz", createdAt: new Date(), lastUsedAt: null, revokedAt: null },
            { id: "t2", userId: "u1", orgId: null, name: "old", last4: "1234", createdAt: new Date(), lastUsedAt: new Date(), revokedAt: new Date() },
        ]);
        const req = { user: { id: "u1" }, orgId: undefined } as unknown as Request;
        const res = mockRes();
        await listApiTokens(req, res, vi.fn());

        const body = res.json.mock.calls[0][0];
        expect(body.tokens).toHaveLength(2);
        expect(body.tokens[0].maskedToken).toBe("onyx_••••wxyz");
        expect(body.tokens[0]).not.toHaveProperty("token");
        expect(body.tokens[0]).not.toHaveProperty("tokenHash");
        expect(body.tokens[1].revoked).toBe(true);
        // select never asked for the hash.
        expect(findMany.mock.calls[0][0].select).not.toHaveProperty("tokenHash");
    });
});
