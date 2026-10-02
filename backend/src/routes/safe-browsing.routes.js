import { Router } from "express";
import { checkUrlsSafetyController } from "../controllers/safe-browsing.controller.js";

const router = Router();

// POST /api/safe-browsing/check
router.post("/check", checkUrlsSafetyController);

export default router;
