import { Router } from "express";
import { analyzeMessage } from "../controllers/analyze.controller.js";

const router = Router();

// POST /api/analyze/message
router.post("/message", analyzeMessage);

// POST /api/analyze (alias)
router.post("/", analyzeMessage);

export default router;