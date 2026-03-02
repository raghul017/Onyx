import { Router } from "express";
import { signup, signin } from "../controllers/auth.controller.js";

const router = Router();

// POST /api/auth/signup
router.post("/signup", signup);

// POST /api/auth/signin
router.post("/signin", signin);

export default router;
