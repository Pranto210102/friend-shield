import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractUrlsFromMessage } from "../services/url-extractor.service.js";
import { resolveRedirects } from "../services/redirect-resolver.service.js";
import { checkUrlsSafety } from "../services/safe-browsing.service.js";
import { extractUrlFeatures, isRecognizedLegitimateDomain } from "../services/feature-extractor.service.js";
import { predictUrlRisk } from "../services/ml-predictor.service.js";
import { generateSafetyExplanation } from "../services/llm-explainer.service.js";
import { analyzeSocialEngineering } from "../services/social-engineering.service.js";
import { ValidationError } from "../utils/errors.js";

const MAX_MESSAGE_LENGTH = 10_000;
const MAX_URLS_TO_PROCESS = 10;

/**
 * Computes an evidence-based risk verdict combining Safe Browsing reputation,
 * deterministic security rules, local ML with uncertainty-aware abstention, and trusted domains.
 */
function computeRiskVerdict(safeBrowsing, signals, mlPrediction, targetUrl = null) {
  // 1. Google Safe Browsing match -> Immediate HIGH_RISK
  if (safeBrowsing && (safeBrowsing.knownThreatFound || (!safeBrowsing.isSafe && safeBrowsing.threats?.length > 0))) {
    return {
      verdict: "HIGH_RISK",
      confidence: "high",
      reason: "Confirmed threat match detected in Google Safe Browsing reputation lists."
    };
  }

  // 2. Critical deterministic security rules
  const hasRawIp = signals.some((s) => s.includes("raw IP address"));
  const hasDowngrade = signals.some((s) => s.includes("downgraded from secure HTTPS"));
  const hasAtSymbol = signals.some((s) => s.includes("@"));
  const hasBrandImpersonation = signals.some((s) => s.includes("Brand impersonation detected"));

  if (hasRawIp || hasDowngrade || hasAtSymbol || hasBrandImpersonation) {
    return {
      verdict: "HIGH_RISK",
      confidence: "high",
      reason: "High-risk structural pattern detected (e.g. brand impersonation, raw IP, HTTPS downgrade, or @ symbol disguise)."
    };
  }

  // 3. Recognized official legitimate domain verification
  let isLegitDomain = false;
  if (targetUrl) {
    try {
      const candidate = targetUrl.startsWith("http://") || targetUrl.startsWith("https://")
        ? targetUrl
        : `https://${targetUrl}`;
      const parsed = new URL(candidate);
      isLegitDomain = isRecognizedLegitimateDomain(parsed.hostname);
    } catch {}
  }

  // If on official verified domain with no security flags -> No Known Threat
  if (isLegitDomain && signals.length === 0) {
    return {
      verdict: "NO_KNOWN_THREAT",
      confidence: "high",
      reason: "Verified official legitimate domain with no security anomalies detected."
    };
  }

  // 4. Local ML model risk probability & Abstention Policy
  const prob = mlPrediction?.phishingProbability ?? mlPrediction?.probability ?? 0.0;
  const uncertainty = mlPrediction?.uncertainty ?? Number((1.0 - 2.0 * Math.abs(prob - 0.5)).toFixed(4));

  // High confidence malicious: Elevated signals or very high ML probability
  if (signals.length >= 2 || (prob >= 0.85 && signals.length >= 1)) {
    return {
      verdict: "SUSPICIOUS",
      confidence: "medium",
      phishingProbability: prob,
      uncertainty,
      reason: `Multiple risk signals detected alongside high ML phishing probability (${(prob * 100).toFixed(1)}%).`
    };
  }

  if (prob >= 0.85 && !isLegitDomain) {
    return {
      verdict: "SUSPICIOUS",
      confidence: "medium",
      phishingProbability: prob,
      uncertainty,
      reason: `Statistical model flagged atypical URL structure with high phishing probability (${(prob * 100).toFixed(1)}%).`
    };
  }

  // Abstention Policy: Model abstains when in the ambiguous boundary zone (0.40 - 0.85)
  if (prob >= 0.40 && !isLegitDomain) {
    return {
      verdict: "NEEDS_REVIEW",
      confidence: "low",
      phishingProbability: prob,
      uncertainty,
      reason: `Abstention zone: Model phishing probability (${(prob * 100).toFixed(1)}%) is ambiguous (uncertainty: ${uncertainty}). Manual review recommended.`
    };
  }

  if (signals.length >= 1) {
    return {
      verdict: "NEEDS_REVIEW",
      confidence: "medium",
      phishingProbability: prob,
      uncertainty,
      reason: `Contains cautionary signal (${signals[0]}).`
    };
  }

  return {
    verdict: "NO_KNOWN_THREAT",
    confidence: "medium",
    phishingProbability: prob,
    uncertainty,
    reason: "No threat match in Google Safe Browsing and local ML indicates low structural risk. (Absence of evidence does not guarantee 100% safety)."
  };
}

/**
 * Controller to analyze a message, extract URLs, resolve redirects,
 * extract numeric features, run ONNX ML inference, query Safe Browsing,
 * and synthesize an empathetic, actionable explanation via Open-Source Gemma 2 LLM.
 */
export async function analyzeMessage(req, res, next) {
  try {
    const {
      message,
      resolveRedirects: shouldResolve = true,
      checkThreats = true,
      explain = true,
      language = "both"
    } = req.body ?? {};

    if (typeof message !== "string") {
      throw new ValidationError("The 'message' field must be a string.");
    }

    const trimmedMessage = message.trim();

    if (trimmedMessage.length === 0) {
      throw new ValidationError("The 'message' cannot be empty.");
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return res.status(413).json({
        success: false,
        error: `The message must not exceed ${MAX_MESSAGE_LENGTH} characters.`
      });
    }

    const urls = extractUrlsFromMessage(trimmedMessage);
    const activeUrls = urls.slice(0, MAX_URLS_TO_PROCESS);

    // 0. Social Engineering Manipulation Index (SEMI)
    const socialEngineering = analyzeSocialEngineering(trimmedMessage);

    // 1. Resolve shorteners / redirects if requested
    if (shouldResolve && activeUrls.length > 0) {
      const resolutionPromises = activeUrls.map((item) =>
        resolveRedirects(item.normalized)
      );

      const results = await Promise.allSettled(resolutionPromises);

      activeUrls.forEach((item, index) => {
        const result = results[index];
        if (result.status === "fulfilled") {
          item.redirectResolution = {
            resolved: true,
            finalUrl: result.value.finalUrl,
            status: result.value.status,
            redirectCount: result.value.redirectCount,
            redirects: result.value.redirects
          };
        } else {
          item.redirectResolution = {
            resolved: false,
            error: result.reason?.message || "Failed to resolve redirects."
          };
        }
      });
    }

    // 2. Query Google Safe Browsing
    const hasApiKey = Boolean(process.env.GOOGLE_SAFE_BROWSING_KEY);
    let threatResults = new Map();

    if (checkThreats && hasApiKey && activeUrls.length > 0) {
      const urlsToCheck = new Set();
      for (const item of activeUrls) {
        urlsToCheck.add(item.normalized);
        if (item.redirectResolution?.finalUrl) {
          urlsToCheck.add(item.redirectResolution.finalUrl);
        }
      }

      try {
        threatResults = await checkUrlsSafety([...urlsToCheck]);
      } catch (err) {
        console.error("Safe Browsing verification warning:", err.message);
      }
    }

    // 3. Extract Features, Run Local ONNX ML Model, and Synthesize Verdict
    let overallThreatDetected = false;

    for (const item of activeUrls) {
      // Safe Browsing verdict
      const origVerdict = threatResults.get(item.normalized) ?? { isSafe: true, threats: [] };
      const finalVerdict = item.redirectResolution?.finalUrl
        ? threatResults.get(item.redirectResolution.finalUrl) ?? { isSafe: true, threats: [] }
        : null;

      const isSafeBrowsingSafe = origVerdict.isSafe && (!finalVerdict || finalVerdict.isSafe);
      const allThreats = [
        ...origVerdict.threats,
        ...(finalVerdict ? finalVerdict.threats : [])
      ];

      item.safeBrowsing = {
        knownThreatFound: !isSafeBrowsingSafe,
        isSafe: isSafeBrowsingSafe,
        threats: allThreats,
        source: "Google Safe Browsing"
      };

      // Feature extraction (using final URL if redirected)
      const targetUrl = item.redirectResolution?.finalUrl || item.normalized;
      const { featureMap, features, signals } = extractUrlFeatures(targetUrl, {
        redirectCount: item.redirectResolution?.redirectCount || 0,
        originalUrl: item.normalized,
        finalUrl: item.redirectResolution?.finalUrl || null
      });

      item.signals = signals;

      // Local ONNX ML prediction
      try {
        const ml = await predictUrlRisk(features);
        item.ml = ml;
      } catch (err) {
        item.ml = { error: err.message };
      }

      // Evidence-based decision
      const decision = computeRiskVerdict(item.safeBrowsing, item.signals, item.ml, targetUrl);
      item.riskAssessment = decision;

      if (decision.verdict === "HIGH_RISK" || decision.verdict === "SUSPICIOUS") {
        overallThreatDetected = true;
      }
    }

    // Determine overall message-level verdict
    let overallVerdict = "NO_KNOWN_THREAT";
    if (activeUrls.some((u) => u.riskAssessment?.verdict === "HIGH_RISK")) {
      overallVerdict = "HIGH_RISK";
    } else if (activeUrls.some((u) => u.riskAssessment?.verdict === "SUSPICIOUS")) {
      overallVerdict = "SUSPICIOUS";
    } else if (activeUrls.some((u) => u.riskAssessment?.verdict === "NEEDS_REVIEW")) {
      overallVerdict = "NEEDS_REVIEW";
    }

    // 4. Generate AI Explanation in Bangla/English via Open-Source Gemma 2 LLM
    let explanation = null;
    if (explain && activeUrls.length > 0) {
      explanation = await generateSafetyExplanation({
        originalMessage: trimmedMessage,
        overallVerdict,
        urls: activeUrls,
        socialEngineering,
        language
      });
    }

    return res.status(200).json({
      success: true,
      messageLength: trimmedMessage.length,
      urlCount: urls.length,
      threatDetected: overallThreatDetected,
      overallVerdict,
      socialEngineering,
      explanation,
      urls: activeUrls
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Server-side OCR fallback endpoint for screenshot and image analysis.
 * Extracts message text and URLs from an uploaded base64 screenshot.
 */
export async function extractImageText(req, res, next) {
  try {
    const { image } = req.body;
    if (!image || typeof image !== "string") {
      throw new ValidationError("Valid image data (base64 string) is required.");
    }

    // Convert data URL (e.g. data:image/png;base64,...) to Buffer
    let base64Data = image;
    const match = image.match(/^data:image\/[a-zA-Z0-9\+\-]+;base64,(.+)$/s);
    if (match && match[1]) {
      base64Data = match[1];
    }
    const buffer = Buffer.from(base64Data, "base64");

    // Perform OCR using Tesseract.js in Node.js with local traineddata
    const { default: Tesseract } = await import("tesseract.js");
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const tessdataDir = path.resolve(__dirname, "../../../frontend/tessdata");

    let rawText = "";
    try {
      const { data } = await Tesseract.recognize(buffer, "eng+ben", {
        langPath: tessdataDir
      });
      rawText = data?.text?.trim() || "";
    } catch (ocrErr) {
      console.warn("Backend eng+ben OCR failed, falling back to eng:", ocrErr.message);
      const { data } = await Tesseract.recognize(buffer, "eng", {
        langPath: tessdataDir
      });
      rawText = data?.text?.trim() || "";
    }

    // Clean up excessive blank lines
    const cleanedText = rawText
      .split("\n")
      .map((line) => line.trim())
      .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1].length > 0))
      .join("\n");

    const urls = extractUrlsFromMessage(cleanedText);

    return res.status(200).json({
      success: true,
      text: cleanedText,
      urls,
      hasText: cleanedText.length >= 3
    });
  } catch (error) {
    next(error);
  }
}

export default {
  analyzeMessage,
  extractImageText
};