import { Router } from "express";
import rateLimit from "express-rate-limit";
import { signup, signin } from "../controllers/auth.controller.js";

const router = Router();

// Rate limit auth endpoints — 5 requests per minute per IP
const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Too many requests",
        message:
            "Too many authentication attempts. Please try again after 1 minute.",
    },
});

// POST /api/auth/signup
router.post("/signup", authLimiter, signup);

// POST /api/auth/signin
router.post("/signin", authLimiter, signin);

export default router;
