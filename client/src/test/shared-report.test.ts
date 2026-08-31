// =============================================================================
// T16b guards for the public shared-report client contract:
//  • getSharedReport must NOT use the intercepted `api` instance (which injects
//    Authorization/x-org-id and force-logs-out on 401) — a logged-out visitor
//    must be able to load a shared report.
//  • the token must be URL-encoded into the path.
// Verified against the source text, so it can't silently regress to `api.get`.
// =============================================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const apiSrc = readFileSync(resolve(__dirname, "../services/api.ts"), "utf8");

/** The body of the getSharedReport function, as written in api.ts. */
function getSharedReportSource(): string {
    const start = apiSrc.indexOf("export async function getSharedReport");
    expect(start).toBeGreaterThan(-1);
    // up to the next top-level export (or EOF)
    const rest = apiSrc.slice(start + 1);
    const end = rest.indexOf("\nexport ");
    return end === -1 ? rest : rest.slice(0, end);
}

describe("getSharedReport — public, unauthenticated", () => {
    const src = getSharedReportSource();

    it("uses a BARE axios call, not the intercepted `api` instance", () => {
        expect(src).toContain("axios.get(");
        // `api.get(` would pull in the auth interceptors — must never appear here.
        expect(src).not.toMatch(/\bapi\.get\(/);
        expect(src).not.toMatch(/\bapi\.post\(/);
    });

    it("hits the public /shared/:token path with the token URL-encoded", () => {
        expect(src).toContain("/shared/");
        expect(src).toContain("encodeURIComponent(token)");
    });

    it("does not set an Authorization or x-org-id header", () => {
        expect(src).not.toMatch(/Authorization/i);
        expect(src).not.toMatch(/x-org-id/i);
    });
});

describe("share bindings exist for the owner controls", () => {
    it("exports create / get / revoke", () => {
        expect(apiSrc).toContain("export async function createReportShare");
        expect(apiSrc).toContain("export async function getReportShare");
        expect(apiSrc).toContain("export async function revokeReportShare");
    });
});
