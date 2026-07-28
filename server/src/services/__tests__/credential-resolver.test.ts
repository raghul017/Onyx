// =============================================================================
// Tests for the credential resolver (T8a): single-flight caching + the one-shot
// 401 refresh helper. Pure — the loader/execute/refresh are injected.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import {
    CredentialResolver,
    executeWithAuthRefresh,
    type ResolvedCredential,
} from "../credential-resolver.js";
import type { AttachedCredential } from "../request-builder.js";

const bearer = (t: string): AttachedCredential => ({ type: "bearer", secret: t });

/** A deferred promise so we can hold the loader "in flight" across concurrent calls. */
function deferred<T>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

describe("CredentialResolver — single-flight", () => {
    it("collapses concurrent resolves for the same (run,recipe) into ONE load", async () => {
        const d = deferred<ResolvedCredential>();
        const loader = vi.fn().mockReturnValue(d.promise);
        const resolver = new CredentialResolver(loader);

        const p1 = resolver.resolve("run1", "rec1");
        const p2 = resolver.resolve("run1", "rec1");
        const p3 = resolver.resolve("run1", "rec1");
        d.resolve({ value: bearer("tok"), dynamic: true });
        const [a, b, c] = await Promise.all([p1, p2, p3]);

        expect(loader).toHaveBeenCalledTimes(1); // single login for the burst
        expect(a.value).toEqual(bearer("tok"));
        expect(b).toBe(a);
        expect(c).toBe(a);
    });

    it("serves a cached value without reloading (within TTL)", async () => {
        const loader = vi.fn().mockResolvedValue({ value: bearer("t1"), dynamic: true });
        const resolver = new CredentialResolver(loader);
        await resolver.resolve("run1", "rec1");
        await resolver.resolve("run1", "rec1");
        expect(loader).toHaveBeenCalledTimes(1);
    });

    it("forceRefresh re-loads; concurrent refreshes collapse to one", async () => {
        let call = 0;
        const loader = vi.fn().mockImplementation(async () => ({
            value: bearer(`t${++call}`),
            dynamic: true,
        }));
        const resolver = new CredentialResolver(loader);

        const first = await resolver.resolve("run1", "rec1");
        expect(first.value).toEqual(bearer("t1"));

        // Two concurrent refreshes → exactly one additional load.
        const [r1, r2] = await Promise.all([
            resolver.resolve("run1", "rec1", { forceRefresh: true }),
            resolver.resolve("run1", "rec1", { forceRefresh: true }),
        ]);
        expect(loader).toHaveBeenCalledTimes(2); // initial + one refresh
        expect(r1.value).toEqual(bearer("t2"));
        expect(r2).toBe(r1);
    });

    it("different runs do not share a cache entry", async () => {
        const loader = vi.fn().mockResolvedValue({ value: bearer("t"), dynamic: true });
        const resolver = new CredentialResolver(loader);
        await resolver.resolve("runA", "rec1");
        await resolver.resolve("runB", "rec1");
        expect(loader).toHaveBeenCalledTimes(2);
    });
});

describe("executeWithAuthRefresh — one-shot 401 refresh", () => {
    const res = (statusCode: number) => ({ statusCode });

    it("401 then 200 => exactly one refresh + one retry, final success", async () => {
        const execute = vi
            .fn()
            .mockResolvedValueOnce(res(401))
            .mockResolvedValueOnce(res(200));
        const refresh = vi.fn().mockResolvedValue(bearer("fresh"));

        const { result, credentialUsed } = await executeWithAuthRefresh({
            credential: bearer("old"),
            canRefresh: true,
            execute,
            refresh,
        });

        expect(execute).toHaveBeenCalledTimes(2);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(result.statusCode).toBe(200);
        expect(credentialUsed).toEqual(bearer("fresh"));
    });

    it("always 401 => one refresh attempt, then graceful give-up (no loop)", async () => {
        const execute = vi.fn().mockResolvedValue(res(401));
        const refresh = vi.fn().mockResolvedValue(bearer("fresh"));

        const { result } = await executeWithAuthRefresh({
            credential: bearer("old"),
            canRefresh: true,
            execute,
            refresh,
        });

        expect(execute).toHaveBeenCalledTimes(2); // original + one retry
        expect(refresh).toHaveBeenCalledTimes(1); // exactly one refresh
        expect(result.statusCode).toBe(401);
    });

    it("failed refresh (null) => give up after the first response", async () => {
        const execute = vi.fn().mockResolvedValue(res(401));
        const refresh = vi.fn().mockResolvedValue(null);

        const { result, credentialUsed } = await executeWithAuthRefresh({
            credential: bearer("old"),
            canRefresh: true,
            execute,
            refresh,
        });

        expect(execute).toHaveBeenCalledTimes(1);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(result.statusCode).toBe(401);
        expect(credentialUsed).toEqual(bearer("old"));
    });

    it("static credential (canRefresh=false) never refreshes on 401", async () => {
        const execute = vi.fn().mockResolvedValue(res(401));
        const refresh = vi.fn();

        const { result } = await executeWithAuthRefresh({
            credential: bearer("static"),
            canRefresh: false,
            execute,
            refresh,
        });

        expect(execute).toHaveBeenCalledTimes(1);
        expect(refresh).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(401);
    });

    it("non-401 first response never refreshes", async () => {
        const execute = vi.fn().mockResolvedValue(res(200));
        const refresh = vi.fn();
        await executeWithAuthRefresh({ credential: bearer("t"), canRefresh: true, execute, refresh });
        expect(execute).toHaveBeenCalledTimes(1);
        expect(refresh).not.toHaveBeenCalled();
    });
});
