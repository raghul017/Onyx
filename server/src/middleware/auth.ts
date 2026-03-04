import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET =
    process.env.JWT_SECRET || "onyx_fallback_secret_do_not_use_in_prod";

if (!process.env.JWT_SECRET) {
    console.warn(
        "[Auth Middleware] ⚠️  JWT_SECRET is not set — using insecure fallback.",
    );
}

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
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        req.user = decoded; // Attached to Express.Request via types/express.d.ts
        next();
    } catch (err) {
        console.error("[Auth] Invalid token:", err);
        res.status(403).json({ error: "Invalid or expired token" });
        return;
    }
}
