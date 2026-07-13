import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../lib/logger.js";

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

/**
 * Middleware that verifies the JWT token from the Authorization header
 * and attaches the decoded user payload to req.user.
 */
export function authenticateToken(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        res.status(401).json({
            error: "Authentication required",
            message: "No token provided",
        });
        return;
    }

    try {
        // Pin the algorithm to HS256. Without this, a token signed with
        // alg:none (or an attacker-chosen algorithm) could be accepted.
        const decoded = jwt.verify(token, JWT_SECRET, {
            algorithms: ["HS256"],
        }) as JwtPayload;
        req.user = decoded; // Attached to Express.Request via types/express.d.ts
        next();
    } catch (err) {
        // Expected for expired/tampered tokens — debug level, no token contents.
        logger.debug({ err }, "Invalid or expired token rejected");
        res.status(403).json({ error: "Invalid or expired token" });
        return;
    }
}
