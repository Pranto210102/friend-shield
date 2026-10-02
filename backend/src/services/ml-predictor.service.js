import path from "node:path";
import fs from "node:fs";
import ort from "onnxruntime-node";

let inferenceSession = null;
let isInitializing = false;
let initPromise = null;

const MODEL_PATH = path.resolve("models/phishing_model.onnx");

/**
 * Initializes and caches the ONNX inference session.
 * @returns {Promise<ort.InferenceSession|null>}
 */
export async function getInferenceSession() {
  if (inferenceSession) {
    return inferenceSession;
  }

  if (isInitializing) {
    return initPromise;
  }

  if (!fs.existsSync(MODEL_PATH)) {
    console.warn(`[ML Predictor] ONNX model file not found at: ${MODEL_PATH}`);
    return null;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      console.log(`[ML Predictor] Loading ONNX model from: ${MODEL_PATH}...`);
      const t0 = performance.now();
      inferenceSession = await ort.InferenceSession.create(MODEL_PATH, {
        executionProviders: ["cpu"],
        graphOptimizationLevel: "all"
      });
      const loadTime = (performance.now() - t0).toFixed(1);
      console.log(`[ML Predictor] Model loaded successfully in ${loadTime} ms.`);
      return inferenceSession;
    } catch (err) {
      console.error("[ML Predictor] Error loading ONNX model:", err.message);
      return null;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

/**
 * Predicts whether a URL is malicious/phishing using the local ONNX model.
 *
 * @param {number[]} features - Array of 17 numeric features matching feature-schema.json.
 * @returns {Promise<{ probability: number, label: string, inferenceTimeMs: number } | null>}
 */
export async function predictUrlRisk(features) {
  if (!Array.isArray(features) || features.length !== 17) {
    throw new Error(
      `Invalid feature vector length: expected 17 features, got ${features?.length}`
    );
  }

  const session = await getInferenceSession();
  if (!session) {
    return null; // Model not available
  }

  const float32Array = new Float32Array(features);
  const inputTensor = new ort.Tensor("float32", float32Array, [1, 17]);
  const feeds = { float_input: inputTensor };

  const tStart = performance.now();
  const outputs = await session.run(feeds);
  const inferenceTimeMs = Number((performance.now() - tStart).toFixed(2));

  // Extract probabilities
  // outputs.probabilities is [p_safe, p_malicious]
  const probData = outputs.probabilities?.data;
  const maliciousProbability = probData ? Number(probData[1]) : 0.0;
  const labelVal = outputs.label?.data?.[0];
  const isMalicious = labelVal === 1n || labelVal === 1 || maliciousProbability >= 0.5;

  return {
    probability: Number(maliciousProbability.toFixed(4)),
    label: isMalicious ? "malicious" : "safe",
    inferenceTimeMs
  };
}

export default {
  getInferenceSession,
  predictUrlRisk
};
