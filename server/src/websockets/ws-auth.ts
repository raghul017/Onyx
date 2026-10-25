// =============================================================================
// WebSocket auth helpers — pure (no DB, no sockets) so they're unit-testable.
// =============================================================================

import jwt from "jsonwebtoken";

/**
 * Who may follow a run's live stream: its owner, or a member of the org that
 * owns it. Mirrors canAccessTestRun on the HTTP side. Pure, for tests.
 */
export function canSubscribeToRun(
    run: { userId: string | null; orgId: string | null },
    userId: string | undefined,
    isOrgMember: boolean,
): boolean {
    if (!userId) return false;
    if (run.userId != null && run.userId === userId) return true;
    return run.orgId != null && isOrgMember;
}

// ---------------------------------------------------------------------------
// Short-lived WS tickets. The browser can't set headers on a WebSocket
// handshake, so a credential has to ride the URL, where proxy access logs can
// record it. Instead of the 7-day session JWT, the client trades its session
// for a 60-second ticket (POST /api/ws-ticket) and connects with that.
// Tickets are signed with a key DERIVED from JWT_SECRET, so a ticket can never
// verify as a session token on the HTTP routes, and vice versa only through the
// explicit legacy path below.
// ---------------------------------------------------------------------------


export const WS_TICKET_TTL_SECONDS = 60;

const ticketKey = (secret: string): string => `${secret}:ws-ticket`;

export interface WsUser {
    id: string;
    email: string;
}

export function issueWsTicket(user: WsUser, secret: string): string {
    return jwt.sign({ id: user.id, email: user.email, purpose: "ws" }, ticketKey(secret), {
        algorithm: "HS256",
        expiresIn: WS_TICKET_TTL_SECONDS,
    });
}

/**
 * Verify the credential on a WS handshake. Accepts a ticket (preferred) or,
 * during the rollout window, the legacy session JWT so a client that hasn't
 * picked up the ticket flow yet keeps streaming. Throws on anything invalid.
 */
export function verifyWsCredential(
    params: { ticket?: string | null; token?: string | null },
    secret: string,
): WsUser & { via: "ticket" | "session" } {
    if (params.ticket) {
        const d = jwt.verify(params.ticket, ticketKey(secret), { algorithms: ["HS256"] }) as {
            id: string;
            email: string;
            purpose?: string;
        };
        if (d.purpose !== "ws") throw new Error("not a ws ticket");
        return { id: d.id, email: d.email, via: "ticket" };
    }
    if (params.token) {
        const d = jwt.verify(params.token, secret, { algorithms: ["HS256"] }) as WsUser;
        return { id: d.id, email: d.email, via: "session" };
    }
    throw new Error("no credential");
}
