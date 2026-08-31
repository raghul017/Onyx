// =============================================================================
// Tests for the BFLA verdict (T14a). Conservative: a finding only when a
// credentialed SECONDARY identity actually succeeded on a privileged function.
// The judge may only VETO — never raise a finding alone.
// =============================================================================
import { describe, it, expect, vi } from "vitest";
import { decideBflaVerdict, type BflaVerdictInput } from "../bfla-verdict.js";

const base = (over: Partial<BflaVerdictInput> = {}): BflaVerdictInput => ({
    method: "GET",
    path: "/admin/users",
    privilegedReason: 'administrative path segment "/admin"',
    aLabel: "admin",
    bLabel: "userB",
    aStatus: 200,
    bStatus: 200, // B allowed → vulnerable by default
    bBody: '{"users":[{"id":1,"email":"a@b.c"}]}',
    ...over,
});

const yesJudge = vi.fn().mockResolvedValue({ isPrivileged: true, reason: "Admin user list." });
const noJudge = vi.fn().mockResolvedValue({ isPrivileged: false, reason: "Public catalog." });

describe("decideBflaVerdict — VULNERABLE", () => {
    it("B 2xx on a privileged endpoint (A 2xx) => CONFIRMED BFLA (API5)", async () => {
        const f = await decideBflaVerdict(base(), yesJudge);
        expect(f).not.toBeNull();
        expect(f!.owaspCategory).toBe("API5_BFLA");
        expect(f!.category).toBe("Broken Function Level Authorization");
        expect(f!.severity).toBe("HIGH"); // GET → not destructive
        expect(f!.confidence).toBe("confirmed");
        expect(f!.evidence).toContain("B (userB)");
        expect(f!.evidence).toContain("A (admin");
        expect(f!.cause).toContain("userB");
        expect(f!.cause).toContain("/admin/users");
        expect(f!.remediation.length).toBeGreaterThan(0);
    });

    it("a DESTRUCTIVE method escalates to CRITICAL", async () => {
        const f = await decideBflaVerdict(
            base({ method: "DELETE", path: "/admin/users/{id}" }),
            yesJudge,
        );
        expect(f!.severity).toBe("CRITICAL");
    });

    it("without a judge => deterministic FIRM verdict (still a finding)", async () => {
        const f = await decideBflaVerdict(base());
        expect(f).not.toBeNull();
        expect(f!.confidence).toBe("firm");
    });
});

describe("decideBflaVerdict — SAFE (no finding)", () => {
    it("B properly denied with 403 => null", async () => {
        expect(await decideBflaVerdict(base({ bStatus: 403 }), yesJudge)).toBeNull();
    });
    it("B denied with 401 => null", async () => {
        expect(await decideBflaVerdict(base({ bStatus: 401 }), yesJudge)).toBeNull();
    });
    it("endpoint not flagged privileged => null", async () => {
        expect(await decideBflaVerdict(base({ privilegedReason: "" }), yesJudge)).toBeNull();
    });
    it("A also 404 (function absent) => null", async () => {
        expect(
            await decideBflaVerdict(base({ aStatus: 404, bStatus: 404 }), yesJudge),
        ).toBeNull();
        // Even a B 2xx is not attributable when A says the route is absent.
        expect(await decideBflaVerdict(base({ aStatus: 404 }), yesJudge)).toBeNull();
    });
    it("judge VETOES (not really administrative) => null", async () => {
        expect(await decideBflaVerdict(base(), noJudge)).toBeNull();
    });
});

describe("decideBflaVerdict — judge resilience", () => {
    it("judge THROWS => deterministic verdict stands (no crash)", async () => {
        const boom = vi.fn().mockRejectedValue(new Error("gemini down"));
        const f = await decideBflaVerdict(base(), boom);
        expect(f).not.toBeNull();
        expect(f!.confidence).toBe("firm");
    });
    it("judge returns null (unconfigured) => deterministic verdict stands", async () => {
        const f = await decideBflaVerdict(base(), vi.fn().mockResolvedValue(null));
        expect(f!.confidence).toBe("firm");
    });
});
