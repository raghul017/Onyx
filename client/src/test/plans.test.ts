// =============================================================================
// Guards the marketing plan/quota constants (T21d) against the server source of
// truth (server/src/lib/plan-limits.ts PLAN_LIMITS + feature gates).
// If the server quotas change, this test should fail and force an update here.
// =============================================================================
import { describe, it, expect } from "vitest";
import { pricingPlans, COMPARE_ROWS, PLAN_COLUMNS } from "../components/plans";

// Mirror of the server PLAN_LIMITS (client-sellable tiers only).
const SERVER_LIMITS = {
    Free: { runs: "5", endpoints: "10" },
    Pro: { runs: "100", endpoints: "50" },
    Team: { runs: "500", endpoints: "200" },
} as const;

const rowByLabel = (label: string) => COMPARE_ROWS.find((r) => r.label === label)!;

describe("marketing plans", () => {
    it("sells exactly Free / Pro / Team (Enterprise is not checkout-able)", () => {
        expect(pricingPlans.map((p) => p.name)).toEqual(["Free", "Pro", "Team"]);
        expect(PLAN_COLUMNS).toEqual(["Free", "Pro", "Team"]);
    });

    it("prices match Billing ($0 / $9 / $18, ₹900 / ₹1800)", () => {
        const [free, pro, team] = pricingPlans;
        expect(free.price).toBe("$0");
        expect(pro.price).toBe("$9");
        expect(pro.inrNote).toContain("₹900");
        expect(team.price).toBe("$18");
        expect(team.inrNote).toContain("₹1800");
    });

    it("Pro is the highlighted (recommended) plan", () => {
        expect(pricingPlans.filter((p) => p.highlight).map((p) => p.name)).toEqual(["Pro"]);
    });

    it("comparison quotas match the server PLAN_LIMITS", () => {
        const runs = rowByLabel("Test runs / month").values;
        const eps = rowByLabel("Endpoints per run").values;
        expect(runs).toEqual([SERVER_LIMITS.Free.runs, SERVER_LIMITS.Pro.runs, SERVER_LIMITS.Team.runs]);
        expect(eps).toEqual([
            SERVER_LIMITS.Free.endpoints,
            SERVER_LIMITS.Pro.endpoints,
            SERVER_LIMITS.Team.endpoints,
        ]);
    });

    it("paid-only gates: PDF export + baseline are Free✗ / Pro✓ / Team✓", () => {
        expect(rowByLabel("PDF report export").values).toEqual([false, true, true]);
        expect(rowByLabel("Baseline capture & diffing").values).toEqual([false, true, true]);
    });

    it("never markets an un-enforced gate: check types, workspaces and API tokens are on every plan", () => {
        expect(rowByLabel("Check types").values).toEqual(["All", "All", "All"]);
        expect(rowByLabel("Workspaces (organizations)").values).toEqual([true, true, true]);
        expect(rowByLabel("API tokens, CLI & GitHub Action").values).toEqual([true, true, true]);
        const allFeatures = pricingPlans.flatMap((p) => p.features).join(" | ");
        expect(allFeatures).not.toMatch(/unlimited|5 attack types|API access|Multi-user/i);
    });

    it("every comparison row has exactly three cells (one per tier)", () => {
        for (const row of COMPARE_ROWS) expect(row.values).toHaveLength(3);
    });
});
