// =============================================================================
// Tests for the BOLA verdict (T13b). Conservative by design: a finding is only
// raised when B got a 2xx AND its body matches A's object. The LLM judge is
// mocked — it can confirm or veto a candidate but never raises one alone, and
// its absence/failure falls back to a deterministic "firm" verdict.
// =============================================================================
import { describe, it, expect, vi } from "vitest";
import { decideBolaVerdict, compareBodies, type BolaVerdictInput } from "../bola-verdict.js";

const A_BODY = JSON.stringify({ id: "42", email: "alice@example.com", ssn: "111-22-3333", owner: "alice" });
const B_OWN_BODY = JSON.stringify({ id: "77", email: "bob@example.com", ssn: "999-88-7777", owner: "bob" });

const base = (over: Partial<BolaVerdictInput> = {}): BolaVerdictInput => ({
    endpoint: "GET /users/{id}",
    objectId: "42",
    aLabel: "userA",
    bLabel: "userB",
    aStatus: 200,
    aBody: A_BODY,
    bStatus: 200,
    bBody: A_BODY, // default: B saw A's object (vulnerable)
    ...over,
});

const yesJudge = vi.fn().mockResolvedValue({ isBola: true, reason: "B received A's record." });
const noJudge = vi.fn().mockResolvedValue({ isBola: false, reason: "Public catalog item." });

describe("compareBodies", () => {
    it("identical bodies are a strong match", () => {
        expect(compareBodies(A_BODY, A_BODY).strength).toBe("strong");
    });
    it("different objects are not a strong match", () => {
        expect(compareBodies(A_BODY, B_OWN_BODY).strength).not.toBe("strong");
    });
    it("reports shared identifying fields", () => {
        const m = compareBodies(A_BODY, A_BODY);
        expect(m.sharedFields).toContain("id");
        expect(m.sharedFields).toContain("email");
    });
});

describe("decideBolaVerdict — VULNERABLE", () => {
    it("B 2xx with A's body + judge agrees => CONFIRMED API1 finding", async () => {
        const finding = await decideBolaVerdict(base(), yesJudge);
        expect(finding).not.toBeNull();
        expect(finding!.owaspCategory).toBe("API1_BOLA");
        expect(finding!.category).toBe("Broken Object Level Authorization");
        expect(finding!.confidence).toBe("confirmed");
        expect(["CRITICAL", "HIGH"]).toContain(finding!.severity);
        // Evidence carries BOTH requests + statuses.
        expect(finding!.evidence).toContain("A (userA)");
        expect(finding!.evidence).toContain("B (userB)");
        expect(finding!.evidence).toContain("200");
        // Plain-English explanation names both identities and the object.
        expect(finding!.cause).toContain("userB");
        expect(finding!.cause).toContain("userA");
        expect(finding!.cause).toContain("42");
        expect(finding!.remediation.length).toBeGreaterThan(0);
    });
});

describe("decideBolaVerdict — SECURE (no finding)", () => {
    it("B denied with 403 => null", async () => {
        expect(await decideBolaVerdict(base({ bStatus: 403, bBody: '{"error":"forbidden"}' }), yesJudge)).toBeNull();
    });
    it("B 404 => null", async () => {
        expect(await decideBolaVerdict(base({ bStatus: 404, bBody: '{"error":"not found"}' }), yesJudge)).toBeNull();
    });
    it("B 2xx but empty body => null", async () => {
        expect(await decideBolaVerdict(base({ bBody: "" }), yesJudge)).toBeNull();
        expect(await decideBolaVerdict(base({ bBody: "{}" }), yesJudge)).toBeNull();
    });
    it("B 2xx but error-shaped body => null", async () => {
        expect(await decideBolaVerdict(base({ bBody: '{"error":"no access"}' }), yesJudge)).toBeNull();
    });
    it("B 2xx with its OWN different data => null", async () => {
        expect(await decideBolaVerdict(base({ bBody: B_OWN_BODY }), yesJudge)).toBeNull();
    });
    it("A itself could not read the object => null (no ground truth)", async () => {
        expect(await decideBolaVerdict(base({ aStatus: 404, aBody: '{"error":"gone"}' }), yesJudge)).toBeNull();
    });
    it("judge VETOES a strong match (e.g. public resource) => null", async () => {
        expect(await decideBolaVerdict(base(), noJudge)).toBeNull();
    });
});

describe("decideBolaVerdict — judge unavailable / failing", () => {
    it("no judge supplied => deterministic FIRM verdict (no crash)", async () => {
        const finding = await decideBolaVerdict(base());
        expect(finding).not.toBeNull();
        expect(finding!.confidence).toBe("firm");
        expect(finding!.owaspCategory).toBe("API1_BOLA");
    });

    it("judge THROWS => deterministic FIRM verdict (never blocks)", async () => {
        const boom = vi.fn().mockRejectedValue(new Error("gemini down"));
        const finding = await decideBolaVerdict(base(), boom);
        expect(finding).not.toBeNull();
        expect(finding!.confidence).toBe("firm");
    });

    it("judge returns null (unconfigured) => deterministic FIRM verdict", async () => {
        const finding = await decideBolaVerdict(base(), vi.fn().mockResolvedValue(null));
        expect(finding!.confidence).toBe("firm");
    });

    it("a WEAK match is never a finding, even without a judge", async () => {
        expect(await decideBolaVerdict(base({ bBody: B_OWN_BODY }))).toBeNull();
    });
});
