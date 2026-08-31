// =============================================================================
// T15c — badge-state rules. The safety-critical one: nothing except an explicit
// "resolved" outcome may ever show Resolved, so an error or an unsupported type
// can never make a live finding look fixed.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
    badgeStateFor,
    badgeStateForOutcome,
    isRescanSupported,
    relativeTime,
} from "../lib/rescan-state";

describe("badgeStateFor — persisted fields on load", () => {
    it("resolvedAt set => resolved", () => {
        expect(badgeStateFor({ resolvedAt: "2026-08-31T10:00:00Z" })).toBe("resolved");
    });

    it("lastCheckedAt only => still_present", () => {
        expect(badgeStateFor({ lastCheckedAt: "2026-08-31T10:00:00Z" })).toBe("still_present");
        expect(
            badgeStateFor({ resolvedAt: null, lastCheckedAt: "2026-08-31T10:00:00Z" }),
        ).toBe("still_present");
    });

    it("neither => no badge (the common case)", () => {
        expect(badgeStateFor({})).toBe("none");
        expect(badgeStateFor({ resolvedAt: null, lastCheckedAt: null })).toBe("none");
        expect(badgeStateFor(undefined)).toBe("none");
        expect(badgeStateFor(null)).toBe("none");
    });

    it("resolvedAt wins when both are set", () => {
        expect(
            badgeStateFor({ resolvedAt: "2026-08-31T11:00:00Z", lastCheckedAt: "2026-08-31T11:00:00Z" }),
        ).toBe("resolved");
    });
});

describe("badgeStateForOutcome — after a re-scan", () => {
    it("maps the two real verdicts", () => {
        expect(badgeStateForOutcome("resolved")).toBe("resolved");
        expect(badgeStateForOutcome("still_present")).toBe("still_present");
    });

    it("NEVER shows resolved for unsupported or error", () => {
        expect(badgeStateForOutcome("unsupported")).toBe("none");
        expect(badgeStateForOutcome("error")).toBe("none");
    });
});

describe("isRescanSupported", () => {
    it("excludes the cross-identity probes the backend can't re-fire", () => {
        expect(isRescanSupported("BOLA_REPLAY")).toBe(false);
        expect(isRescanSupported("BFLA_PROBE")).toBe(false);
    });

    it("supports the ordinary finding types", () => {
        for (const t of ["SQL_INJECTION", "XSS", "MASS_ASSIGNMENT", "DATA_EXPOSURE"]) {
            expect(isRescanSupported(t)).toBe(true);
        }
    });

    it("defaults to supported for an unknown/absent type (backend decides)", () => {
        expect(isRescanSupported(undefined)).toBe(true);
        expect(isRescanSupported(null)).toBe(true);
    });
});

describe("relativeTime", () => {
    const now = new Date("2026-08-31T12:00:00Z").getTime();
    it("formats recent times compactly", () => {
        expect(relativeTime("2026-08-31T11:59:30Z", now)).toBe("just now");
        expect(relativeTime("2026-08-31T11:55:00Z", now)).toBe("5m ago");
        expect(relativeTime("2026-08-31T09:00:00Z", now)).toBe("3h ago");
        expect(relativeTime("2026-08-29T12:00:00Z", now)).toBe("2d ago");
    });
    it("is safe for null/invalid input", () => {
        expect(relativeTime(null, now)).toBe("");
        expect(relativeTime(undefined, now)).toBe("");
        expect(relativeTime("not-a-date", now)).toBe("");
    });
});
