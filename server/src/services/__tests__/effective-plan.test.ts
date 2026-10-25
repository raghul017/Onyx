// Org effective plan: the better of the org's plan and its owners' active paid
// plans. Prisma is mocked, so no live DB.
import { describe, it, expect, vi, beforeEach } from "vitest";

const orgFind = vi.fn();
const userFind = vi.fn();

vi.mock("../../lib/prisma.js", () => ({
    prisma: {
        organization: { findUnique: (...a: unknown[]) => orgFind(...a) },
        user: { findUnique: (...a: unknown[]) => userFind(...a) },
    },
}));

const { getEffectivePlan, bestPlan } = await import("../org.service.js");

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);
const owner = (plan: string, planExpiresAt: Date | null = future) => ({ user: { plan, planExpiresAt } });

describe("getEffectivePlan in an org", () => {
    beforeEach(() => {
        orgFind.mockReset();
        userFind.mockReset();
    });

    it("a paying Team owner keeps Team limits inside their own org", async () => {
        orgFind.mockResolvedValue({ plan: "FREE", planExpiresAt: null, members: [owner("TEAM")] });
        expect(await getEffectivePlan("u1", "org-1")).toBe("TEAM");
    });

    it("an org's own paid plan still applies", async () => {
        orgFind.mockResolvedValue({ plan: "PRO", planExpiresAt: future, members: [owner("FREE", null)] });
        expect(await getEffectivePlan("u1", "org-1")).toBe("PRO");
    });

    it("an owner's EXPIRED plan doesn't count", async () => {
        orgFind.mockResolvedValue({ plan: "FREE", planExpiresAt: null, members: [owner("TEAM", past)] });
        expect(await getEffectivePlan("u1", "org-1")).toBe("FREE");
    });

    it("only owners are considered (the query filters role OWNER)", async () => {
        orgFind.mockResolvedValue({ plan: "FREE", planExpiresAt: null, members: [] });
        await getEffectivePlan("u1", "org-1");
        expect(orgFind.mock.calls[0][0].select.members.where).toEqual({ role: "OWNER" });
    });

    it("outside an org, it's the user's own plan", async () => {
        userFind.mockResolvedValue({ plan: "PRO", planExpiresAt: future });
        expect(await getEffectivePlan("u1", null)).toBe("PRO");
        expect(orgFind).not.toHaveBeenCalled();
    });
});

describe("bestPlan", () => {
    it("ranks FREE < PRO < TEAM < ENTERPRISE", () => {
        expect(bestPlan("FREE", "PRO")).toBe("PRO");
        expect(bestPlan("TEAM", "PRO")).toBe("TEAM");
        expect(bestPlan()).toBe("FREE");
    });
});
