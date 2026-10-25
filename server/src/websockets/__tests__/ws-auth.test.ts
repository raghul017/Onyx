import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { canSubscribeToRun, issueWsTicket, verifyWsCredential } from "../ws-auth.js";
import { deployedCommit } from "../../lib/deploy-info.js";

const SECRET = "test-secret";
const user = { id: "u1", email: "a@x.com" };

describe("canSubscribeToRun — same rule as the HTTP routes", () => {
    it("allows the run's owner", () => {
        expect(canSubscribeToRun({ userId: "u1", orgId: null }, "u1", false)).toBe(true);
    });
    it("allows an org member who didn't start the run", () => {
        expect(canSubscribeToRun({ userId: "u2", orgId: "o1" }, "u1", true)).toBe(true);
    });
    it("blocks a signed-in stranger", () => {
        expect(canSubscribeToRun({ userId: "u2", orgId: "o1" }, "u1", false)).toBe(false);
    });
    it("blocks everyone on a run with no owner and no org (was open before)", () => {
        expect(canSubscribeToRun({ userId: null, orgId: null }, "u1", false)).toBe(false);
    });
    it("blocks a socket with no user id", () => {
        expect(canSubscribeToRun({ userId: "u1", orgId: null }, undefined, false)).toBe(false);
    });
});

describe("WS tickets", () => {
    it("a fresh ticket verifies as that user", () => {
        const t = issueWsTicket(user, SECRET);
        expect(verifyWsCredential({ ticket: t }, SECRET)).toMatchObject({ ...user, via: "ticket" });
    });
    it("a ticket expires after 60 seconds", () => {
        const expired = jwt.sign({ ...user, purpose: "ws", exp: Math.floor(Date.now() / 1000) - 1 }, `${SECRET}:ws-ticket`);
        expect(() => verifyWsCredential({ ticket: expired }, SECRET)).toThrow();
    });
    it("a ticket is NOT a valid session token (different signing key)", () => {
        const t = issueWsTicket(user, SECRET);
        expect(() => jwt.verify(t, SECRET, { algorithms: ["HS256"] })).toThrow();
    });
    it("a session JWT can't be passed off as a ticket", () => {
        const session = jwt.sign(user, SECRET, { algorithm: "HS256" });
        expect(() => verifyWsCredential({ ticket: session }, SECRET)).toThrow();
    });
    it("still accepts the legacy session token during rollout", () => {
        const session = jwt.sign(user, SECRET, { algorithm: "HS256" });
        expect(verifyWsCredential({ token: session }, SECRET)).toMatchObject({ ...user, via: "session" });
    });
    it("rejects a session token signed with a non-HS256 algorithm", () => {
        const hs512 = jwt.sign(user, SECRET, { algorithm: "HS512" });
        expect(() => verifyWsCredential({ token: hs512 }, SECRET)).toThrow();
    });
    it("rejects a handshake with no credential", () => {
        expect(() => verifyWsCredential({}, SECRET)).toThrow();
    });
});

describe("deployedCommit — GET /api/health", () => {
    it("prefers Render's commit", () => {
        expect(deployedCommit({ RENDER_GIT_COMMIT: "abc123", GIT_COMMIT: "def" })).toBe("abc123");
    });
    it("falls back to GIT_COMMIT", () => {
        expect(deployedCommit({ GIT_COMMIT: "def456" })).toBe("def456");
    });
    it("is null when neither is set", () => {
        expect(deployedCommit({})).toBeNull();
    });
});
