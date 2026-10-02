import { extractUrlsFromMessage } from "../services/url-extractor.service.js";
import { resolveRedirects } from "../services/redirect-resolver.service.js";
import { checkUrlsSafety } from "../services/safe-browsing.service.js";
import { extractUrlFeatures } from "../services/feature-extractor.service.js";
import { predictUrlRisk } from "../services/ml-predictor.service.js";
import { ValidationError } from "../utils/errors.js";

const MAX_MESSAGE_LENGTH = 10_000;
const MAX_URLS_TO_PROCESS = 10;

/**
 * Computes an evidence-based risk verdict combining Safe Browsing, Deterministic Rules, and Local ML.
 */
function computeRiskVerdict(safeBrowsing, signals, mlPrediction) {
  // 1. Google Safe Browsing match -> Immediate HIGH_RISK
  if (safeBrowsing && !safeBrowsing.isSafe && safeBrowsing.threats?.length > 0) {
    return {
      verdict: "HIGH_RISK",
      confidence: "high",
      reason: "Confirmed threat detected in Google Safe Browsing lists."
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
      reason: "High-risk pattern detected (e.g. brand impersonation, raw IP, HTTPS downgrade, or @ symbol disguise)."
    };
  }

  // 3. Local ML model risk probability
  const prob = mlPrediction?.probability ?? 0.0;

  if (prob >= 0.80) {
    return {
      verdict: "SUSPICIOUS",
      confidence: "medium",
      reason: `Local ML model estimated a high phishing probability (${(prob * 100).toFixed(1)}%).`
    };
  }

  if (prob >= 0.50 || signals.length >= 2) {
    return {
      verdict: "NEEDS_REVIEW",
      confidence: "medium",
      reason: `Multiple risk signals or moderate ML probability (${(prob * 100).toFixed(1)}%) present.`
    };
  }

  return {
    verdict: "NO_KNOWN_THREAT",
    confidence: "low_to_medium",
    reason: "No known threats found in Safe Browsing and local ML indicates low risk. (Does not guarantee 100% safety)."
  };
}

/**
 * Controller to analyze a message, extract URLs, resolve redirects,
 * extract numeric features, run ONNX ML inference, and query Safe Browsing.
 */
export async function analyzeMessage(req, res, next) {
  try {
    const {
      message,
      resolveRedirects: shouldResolve = true, // default to true for comprehensive analysis
      checkThreats = true
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

    // 3. Extract Features, Run Local ONNX ML Model, and Synthesize Final Decision
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
      const decision = computeRiskVerdict(item.safeBrowsing, item.signals, item.ml);
      item.riskAssessment = decision;

      if (decision.verdict === "HIGH_RISK" || decision.verdict === "SUSPICIOUS") {
        overallThreatDetected = true;
      }
    }

    return res.status(200).json({
      success: true,
      messageLength: trimmedMessage.length,
      urlCount: urls.length,
      threatDetected: overallThreatDetected,
      urls: activeUrls
    });
  } catch (error) {
    next(error);
  }
}

export default {
  analyzeMessage
};