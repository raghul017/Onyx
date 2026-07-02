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

// 12 rounds is the current sensible default: meaningfully harder to brute-force
// than 8 while keeping signup/signin latency imperceptible on modern hardware.
const BCRYPT_SALT_ROUNDS = 12;

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

        // OAuth-only account (no password set) cannot sign in with a password
        if (!user.passwordHash) {
            res.status(401).json({
                error: "This account uses social sign-in. Continue with Google or GitHub.",
            });
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

// ---------------------------------------------------------------------------
// OAuth (server-side redirect flow) — Google & GitHub
// ---------------------------------------------------------------------------

const CLIENT_URL = (process.env.CLIENT_URL || "http://localhost:8080")
    .split(",")[0]
    .trim();
const SERVER_URL = (process.env.SERVER_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
);

function issueToken(user: { id: string; email: string }): string {
    return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: "7d",
    });
}

// Provider config; a provider is "configured" only when both env vars are set.
type Provider = "google" | "github";

function providerConfig(provider: Provider) {
    if (provider === "google") {
        return {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
            scope: "openid email profile",
        };
    }
    return {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        authorizeUrl: "https://github.com/login/oauth/authorize",
        scope: "read:user user:email",
    };
}

const redirectUri = (provider: Provider) =>
    `${SERVER_URL}/api/auth/${provider}/callback`;

// GET /api/auth/:provider  → redirect to the provider's consent screen
export async function oauthRedirect(
    req: Request,
    res: Response,
): Promise<void> {
    const provider = req.params.provider as Provider;
    if (provider !== "google" && provider !== "github") {
        res.status(404).json({ error: "Unknown provider" });
        return;
    }
    const cfg = providerConfig(provider);
    if (!cfg.clientId || !cfg.clientSecret) {
        res.status(400).json({
            error: `${provider === "google" ? "Google" : "GitHub"} sign-in is not configured.`,
        });
        return;
    }

    const state = jwt.sign({ provider }, JWT_SECRET, { expiresIn: "10m" });
    const params = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: redirectUri(provider),
        response_type: "code",
        scope: cfg.scope,
        state,
    });
    res.redirect(`${cfg.authorizeUrl}?${params.toString()}`);
}

// Land back on the frontend with the JWT in the URL fragment (never logged).
function backToClient(res: Response, fragment: string) {
    res.redirect(`${CLIENT_URL}/auth/callback#${fragment}`);
}

// GET /api/auth/:provider/callback → exchange code, upsert user, issue our JWT
export async function oauthCallback(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const provider = req.params.provider as Provider;
    try {
        if (provider !== "google" && provider !== "github") {
            res.status(404).json({ error: "Unknown provider" });
            return;
        }
        const cfg = providerConfig(provider);
        if (!cfg.clientId || !cfg.clientSecret) {
            backToClient(res, "error=not_configured");
            return;
        }

        const code = req.query.code as string | undefined;
        const state = req.query.state as string | undefined;
        if (!code || !state) {
            backToClient(res, "error=missing_code");
            return;
        }
        // Validate CSRF state (pin algorithm to HS256 to match how we sign it).
        try {
            const decoded = jwt.verify(state, JWT_SECRET, {
                algorithms: ["HS256"],
            }) as { provider?: string };
            if (decoded.provider !== provider) throw new Error("state mismatch");
        } catch {
            backToClient(res, "error=bad_state");
            return;
        }

        // Exchange the authorization code for an access token
        const profile =
            provider === "google"
                ? await fetchGoogleProfile(code, cfg)
                : await fetchGitHubProfile(code, cfg);

        if (!profile || !profile.email) {
            backToClient(res, "error=no_email");
            return;
        }

        // Find by provider id → by email (link) → else create
        const idField = provider === "google" ? "googleId" : "githubId";
        let user = await prisma.user.findFirst({
            where: { [idField]: profile.id },
        });
        if (!user) {
            user = await prisma.user.findUnique({
                where: { email: profile.email },
            });
            if (user) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        [idField]: profile.id,
                        avatarUrl: user.avatarUrl ?? profile.avatarUrl,
                    },
                });
            } else {
                user = await prisma.user.create({
                    data: {
                        email: profile.email,
                        [idField]: profile.id,
                        avatarUrl: profile.avatarUrl,
                    },
                });
            }
        }

        const token = issueToken(user);
        backToClient(res, `token=${token}`);
    } catch (err) {
        // Don't leak details to the browser; log + send a generic failure.
        console.error(`[oauth:${provider}]`, err);
        backToClient(res, "error=oauth_failed");
    }
}

interface OAuthProfile {
    id: string;
    email: string | null;
    avatarUrl: string | null;
}

async function fetchGoogleProfile(
    code: string,
    cfg: ReturnType<typeof providerConfig>,
): Promise<OAuthProfile> {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: cfg.clientId!,
            client_secret: cfg.clientSecret!,
            redirect_uri: redirectUri("google"),
            grant_type: "authorization_code",
        }),
    });
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) throw new Error("google token exchange failed");

    const userRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        { headers: { Authorization: `Bearer ${tokenJson.access_token}` } },
    );
    const u = (await userRes.json()) as {
        id: string;
        email: string | null;
        verified_email?: boolean;
        picture: string | null;
    };
    // Only trust a verified Google email. An unverified email could be attacker-
    // controlled, and since we link accounts by email that would allow taking
    // over an existing account (account-linking attack).
    if (!u.verified_email) {
        return { id: u.id, email: null, avatarUrl: u.picture };
    }
    return { id: u.id, email: u.email, avatarUrl: u.picture };
}

async function fetchGitHubProfile(
    code: string,
    cfg: ReturnType<typeof providerConfig>,
): Promise<OAuthProfile> {
    const tokenRes = await fetch(
        "https://github.com/login/oauth/access_token",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            },
            body: new URLSearchParams({
                code,
                client_id: cfg.clientId!,
                client_secret: cfg.clientSecret!,
                redirect_uri: redirectUri("github"),
            }),
        },
    );
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) throw new Error("github token exchange failed");

    const headers = {
        Authorization: `Bearer ${tokenJson.access_token}`,
        "User-Agent": "Onyx",
        Accept: "application/vnd.github+json",
    };
    const userRes = await fetch("https://api.github.com/user", { headers });
    const u = (await userRes.json()) as {
        id: number;
        email: string | null;
        avatar_url: string | null;
    };
    // GitHub may not return a public email; fetch the primary verified one.
    let email = u.email;
    if (!email) {
        const emailsRes = await fetch("https://api.github.com/user/emails", {
            headers,
        });
        const emails = (await emailsRes.json()) as Array<{
            email: string;
            primary: boolean;
            verified: boolean;
        }>;
        email =
            emails.find((e) => e.primary && e.verified)?.email ??
            emails.find((e) => e.verified)?.email ??
            null;
    }
    return { id: String(u.id), email, avatarUrl: u.avatar_url };
}
