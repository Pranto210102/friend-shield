import { Router } from "express";
import { analyzeMessage, extractImageText, explainAnalysis } from "../controllers/analyze.controller.js";

const router = Router();

// POST /api/analyze/message
router.post("/message", analyzeMessage);

// POST /api/analyze/explain (Async Progressive Gemma explanation)
router.post("/explain", explainAnalysis);

// POST /api/analyze/extract-image (Screenshot OCR extraction)
router.post("/extract-image", extractImageText);

// POST /api/analyze (alias)
router.post("/", analyzeMessage);

export default router;