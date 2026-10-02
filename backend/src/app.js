import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import analyzeRoutes from "./routes/analyze.routes.js";
import redirectRoutes from "./routes/redirect.routes.js";
import safeBrowsingRoutes from "./routes/safe-browsing.routes.js";
import { AppError } from "./utils/errors.js";

const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, "../../frontend");
const frontedDir = path.resolve(__dirname, "../../fronted");
const frontendPath = fs.existsSync(frontendDir) ? frontendDir : frontedDir;

app.disable("x-powered-by");

// Basic security headers
app.use(helmet());

// Dynamic CORS configuration (allows local files, any localhost port, or specified CLIENT_URL)
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true
  })
);

// Serve frontend UI statically on root
app.use(express.static(frontendPath));

// Body parser with size limits
app.use(
  express.json({
    limit: "100kb"
  })
);

// General rate limiter: 100 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED"
  }
});
app.use(generalLimiter);

// Specific rate limiter for outbound requests (prevents DDoS/SSRF abuse)
const outboundLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many outbound verification requests. Please slow down.",
    code: "OUTBOUND_RATE_LIMIT_EXCEEDED"
  }
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use("/api/analyze", analyzeRoutes);
app.use("/api/redirects", outboundLimiter, redirectRoutes);
app.use("/api/safe-browsing", outboundLimiter, safeBrowsingRoutes);

// 404 Route Not Found handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found.",
    code: "NOT_FOUND"
  });
});

// Centralized error handling middleware
app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || (error instanceof AppError ? error.statusCode : 500);
  const code = error.code || (statusCode >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST");

  if (statusCode >= 500) {
    console.error("Unhandled error:", error);
  }

  res.status(statusCode).json({
    success: false,
    error: error.message || "Internal server error.",
    code
  });
});

export default app;