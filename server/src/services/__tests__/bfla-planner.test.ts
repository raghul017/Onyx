// =============================================================================
// Tests for the BFLA planner (T14a) — probes are planned ONLY when the run has
// >=2 identities (with a credentialed secondary) AND privileged endpoints exist.
// A single-identity / no-admin-route run plans nothing, so normal scans are
// completely unaffected.
// =============================================================================
import { describe, it, expect } from "vitest";
import { planBflaProbes, type BflaCandidateEndpoint } from "../bfla-planner.js";
import { MAX_REPLAY_JOBS, type PlannerIdentity } from "../bola-planner.js";

const A: PlannerIdentity = { id: "id-a", authRecipeId: "recipe-a", isPrimary: true };
const B: PlannerIdentity = { id: "id-b", authRecipeId: "recipe-b", isPrimary: false };
const ANON: PlannerIdentity = { id: "id-anon", authRecipeId: null, isPrimary: false };

const adminEp: BflaCandidateEndpoint = {
    endpointId: "ep-admin",
    method: "GET",
    path: "/admin/users",
};
const publicEp: BflaCandidateEndpoint = {
    endpointId: "ep-pub",
    method: "GET",
    path: "/products",
};

describe("planBflaProbes — plans probes", () => {
    it("plans one probe per (privileged endpoint x credentialed secondary)", () => {
        const { specs, skipReason } = planBflaProbes([A, B], [adminEp, publicEp]);
        expect(skipReason).toBeNull();
        expect(specs).toHaveLength(1); // only the admin endpoint, only B
        const s = specs[0]!;
        expect(s.endpointId).toBe("ep-admin");
        expect(s.checkType).toBe("bfla");
        expect(s.sourceIdentityId).toBe("id-a"); // A = primary
        expect(s.targetIdentityId).toBe("id-b"); // B = secondary
        expect(s.objectId).toBe(""); // BFLA needs no object id
        expect(s.privilegedReason).toContain("admin");
    });

    it("fans out across multiple credentialed secondaries", () => {
        const C: PlannerIdentity = { id: "id-c", authRecipeId: "recipe-c", isPrimary: false };
        const { specs } = planBflaProbes([A, B, C], [adminEp]);
        expect(specs.map((s) => s.targetIdentityId).sort()).toEqual(["id-b", "id-c"]);
    });

    it("is bounded by MAX_REPLAY_JOBS", () => {
        const many = Array.from({ length: MAX_REPLAY_JOBS + 20 }, (_, i) => ({
            endpointId: `ep-${i}`,
            method: "GET",
            path: `/admin/thing-${i}`,
        }));
        const { specs } = planBflaProbes([A, B], many);
        expect(specs.length).toBeLessThanOrEqual(MAX_REPLAY_JOBS);
    });
});

describe("planBflaProbes — graceful skips (normal scans unaffected)", () => {
    it("single identity => no probes", () => {
        const { specs, skipReason } = planBflaProbes([A], [adminEp]);
        expect(specs).toHaveLength(0);
        expect(skipReason).toMatch(/fewer than 2/i);
    });

    it("no privileged endpoints => no probes", () => {
        const { specs, skipReason } = planBflaProbes([A, B], [publicEp]);
        expect(specs).toHaveLength(0);
        expect(skipReason).toMatch(/privileged/i);
    });

    it("no credentialed secondary (only anonymous) => no probes", () => {
        // Anonymous B is MISSING_AUTH's job, not BFLA's — avoids double-reporting.
        const { specs, skipReason } = planBflaProbes([A, ANON], [adminEp]);
        expect(specs).toHaveLength(0);
        expect(skipReason).toMatch(/credentialed secondary/i);
    });

    it("no primary => no probes", () => {
        const { specs, skipReason } = planBflaProbes(
            [{ ...A, isPrimary: false }, B],
            [adminEp],
        );
        expect(specs).toHaveLength(0);
        expect(skipReason).toMatch(/primary/i);
    });

    it("no endpoints at all => no probes", () => {
        expect(planBflaProbes([A, B], []).specs).toHaveLength(0);
    });
});
