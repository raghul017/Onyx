import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { isApiToken, hashApiToken } from "../services/api-token.service.js";

const _jwtSecret = process.env.JWT_SECRET;
if (!_jwtSecret) {
    logger.fatal(
        "JWT_SECRET environment variable is required. Server cannot start without it.",
    );
    process.exit(1);
}
const JWT_SECRET: string = _jwtSecret;

interface JwtPayload {
    id: string;
    email: string;
}

const API_TOKEN_LAST_USED_THROTTLE_MS = 60_000; // update lastUsedAt at most once/min

/**
 * Authenticate an API token (Authorization: Bearer onyx_...). Looks the token up
 * by its SHA-256 hash, rejects unknown/revoked tokens, and returns the same
 * { user, orgId } context a JWT session would establish — so downstream scoping,
 * RBAC, and quota behave identically. Bumps lastUsedAt (throttled, non-blocking).
 * The plaintext token is NEVER logged. Returns null when the token is invalid.
 */
async function resolveApiToken(
    plaintext: string,
): Promise<{ user: { id: string; email: string }; orgId?: string } | null> {
    const tokenHash = hashApiToken(plaintext);
    const row = await prisma.apiToken.findUnique({
        where: { tokenHash },
        select: {
            id: true,
            userId: true,
            orgId: true,
            revokedAt: true,
            lastUsedAt: true,
            user: { select: { id: true, email: true } },
        },
    });
    // Unknown, revoked, or missing an owner → no identity can be established.
    if (!row || row.revokedAt !== null || !row.user) return null;

    // Throttled, fire-and-forget "last used" bump — never blocks the request.
    const stale =
        row.lastUsedAt === null ||
        Date.now() - row.lastUsedAt.getTime() > API_TOKEN_LAST_USED_THROTTLE_MS;
    if (stale) {
        void prisma.apiToken
            .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
            .catch(() => {
                /* best-effort; a failed bump must not fail the request */
            });
    }

    return {
        user: { id: row.user.id, email: row.user.email },
        orgId: row.orgId ?? undefined,
    };
}

/**
 * Middleware that authenticates the caller from the Authorization header. An
 * "onyx_"-prefixed bearer value is treated as an API token (looked up by hash);
 * anything else is verified as a JWT. Either way it attaches req.user (+ req.orgId
 * for org-pinned tokens) so the rest of the stack is auth-mechanism-agnostic.
 */
export async function authenticateToken(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        res.status(401).json({
            error: "Authentication required",
            message: "No token provided",
        });
        return;
    }

    // --- API token path (non-interactive: CLI / CI) ---
    if (isApiToken(token)) {
        try {
            const ctx = await resolveApiToken(token);
            if (!ctx) {
                res.status(401).json({ error: "Invalid or revoked API token" });
                return;
            }
            req.user = ctx.user;
            req.authMethod = "apiToken";
            // Pin the org context when the token is org-scoped. injectOrgContext
            // only overrides this when an x-org-id header is present + verified.
            if (ctx.orgId) req.orgId = ctx.orgId;
            next();
        } catch (err) {
            logger.error({ err }, "API token authentication failed");
            res.status(500).json({ error: "Authentication error" });
        }
        return;
    }

    // --- JWT path (interactive session) ---
    try {
        // Pin the algorithm to HS256. Without this, a token signed with
        // alg:none (or an attacker-chosen algorithm) could be accepted.
        const decoded = jwt.verify(token, JWT_SECRET, {
            algorithms: ["HS256"],
        }) as JwtPayload;
        req.user = decoded; // Attached to Express.Request via types/express.d.ts
        req.authMethod = "jwt";
        next();
    } catch (err) {
        // Expected for expired/tampered tokens — debug level, no token contents.
        logger.debug({ err }, "Invalid or expired token rejected");
        res.status(403).json({ error: "Invalid or expired token" });
        return;
    }
}

/**
 * Guard for endpoints that must be driven by an interactive session, NOT an API
 * token — so a leaked token can't mint or revoke more tokens (T10a). Use AFTER
 * authenticateToken.
 */
export function requireSessionAuth(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    if (req.authMethod === "apiToken") {
        res.status(403).json({
            error: "SESSION_REQUIRED",
            message: "API tokens are managed from an interactive session, not with an API token.",
        });
        return;
    }
    next();
}
