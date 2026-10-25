import { describe, it, expect, beforeEach } from "vitest";

// A plain function (not a vi.fn spy) so a rejected ticket request is a real
// rejection the code under test catches, with no spy bookkeeping involved.
const state = vi.hoisted(() => ({
    calls: [] as string[],
    respond: (_url: string): Promise<{ data: { ticket?: string } }> => Promise.resolve({ data: {} }),
}));
vi.mock("@/services/api", () => ({
    api: {
        post: (url: string) => {
            state.calls.push(url);
            return state.respond(url);
        },
    },
}));

import { wsCredentialQuery } from "@/store/useAttackStore";

describe("wsCredentialQuery — the WS handshake never carries the session JWT when a ticket is available", () => {
    beforeEach(() => {
        state.calls = [];
    });

    it("uses a short-lived ticket", async () => {
        state.respond = () => Promise.resolve({ data: { ticket: "tkt.abc" } });
        await expect(wsCredentialQuery("session.jwt")).resolves.toBe("?ticket=tkt.abc");
        expect(state.calls).toEqual(["/ws-ticket"]);
    });

    it("falls back to the session token when the server has no ticket endpoint yet", async () => {
        state.respond = () => Promise.reject(new Error("404"));
        await expect(wsCredentialQuery("session.jwt")).resolves.toBe("?token=session.jwt");
    });

    it("sends nothing when signed out", async () => {
        await expect(wsCredentialQuery(null)).resolves.toBe("");
        expect(state.calls).toEqual([]);
    });
});
