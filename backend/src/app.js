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
const frontendPath = path.resolve(__dirname, "../../frontend");

app.disable("x-powered-by");

// Security headers configured for client-side WASM OCR, web workers, and fonts
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "'wasm-unsafe-eval'",
          "https://cdn.jsdelivr.net"
        ],
        workerSrc: ["'self'", "blob:", "data:"],
        connectSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://cdn.jsdelivr.net",
          "https://tessdata.projectnaptha.com"
        ],
        imgSrc: ["'self'", "data:", "blob:"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com"
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        objectSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

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

// Body parser with size limits (15MB to support screenshot image payloads)
app.use(
  express.json({
    limit: "15mb"
  })
);

// Lightweight Health Check Endpoint (placed before rate limiter for keep-alive pings)
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

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