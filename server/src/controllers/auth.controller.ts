import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { authSchema } from "../validators/schemas.js";

const _jwtSecret = process.env.JWT_SECRET;
if (!_jwtSecret) {
    console.error(
        "FATAL: JWT_SECRET environment variable is required. Server cannot start without it.",
    );
    process.exit(1);
}
const JWT_SECRET: string = _jwtSecret;

const BCRYPT_SALT_ROUNDS = 8;

// ---------------------------------------------------------------------------
// POST /api/auth/signup
// ---------------------------------------------------------------------------

export async function signup(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const validation = authSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                error: "Validation failed",
                details: validation.error.issues,
            });
            return;
        }

        const { email, password } = validation.data;

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(409).json({ error: "Email already in use" });
            return;
        }

        // Hash password and create user
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        const user = await prisma.user.create({
            data: { email, passwordHash },
        });

        // Generate JWT
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
            expiresIn: "7d",
        });

        res.status(201).json({
            message: "User created successfully",
            token,
            user: { id: user.id, email: user.email },
        });
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// POST /api/auth/signin
// ---------------------------------------------------------------------------

export async function signin(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const validation = authSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                error: "Validation failed",
                details: validation.error.issues,
            });
            return;
        }

        const { email, password } = validation.data;

        // Find user
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: "Invalid email or password" });
            return;
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
            res.status(401).json({ error: "Invalid email or password" });
            return;
        }

        // Generate JWT
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
            expiresIn: "7d",
        });

        res.json({
            message: "Signed in successfully",
            token,
            user: { id: user.id, email: user.email },
        });
    } catch (err) {
        next(err);
    }
}
