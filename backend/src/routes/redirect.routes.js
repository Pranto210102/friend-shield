import { Router } from "express";
import { resolveUrlRedirect } from "../controllers/redirect.controller.js";

const router = Router();

// POST /api/redirects/resolve
router.post("/resolve", resolveUrlRedirect);

export default router;