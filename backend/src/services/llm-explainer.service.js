/**
 * Service to generate human-friendly, actionable explanations in Bangla, English, and Banglish
 * using Google's Gemini LLM.
 */

const GEMINI_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite"
];

/**
 * Fallback template generator when LLM is unavailable or offline.
 */
function generateFallbackExplanation(overallVerdict, urls) {
  const isHighRisk = overallVerdict === "HIGH_RISK" || overallVerdict === "SUSPICIOUS";

  if (isHighRisk) {
    return {
      summary_bn: "⚠️ উচ্চ সতর্কতা! এই বার্তাটিতে সন্দেহজনক বা বিপজ্জনক লিংক পাওয়া গেছে।",
      explanation_bn: "আমাদের নিরাপত্তা বিশ্লেষণ অনুযায়ী এই লিংকটি ব্যক্তিগত তথ্য বা আর্থিক অ্যাকাউন্ট হাতিয়ে নেওয়ার জন্য তৈরি হতে পারে।",
      action_advice_bn: "১. কোনো অবস্থাতেই এই লিংকে ক্লিক করবেন না।\n২. আপনার বিকাশ/নগদ পিন, ওটিপি বা পাসওয়ার্ড কারো সাথে শেয়ার করবেন না।",
      summary_en: "⚠️ High Risk! A suspicious or fraudulent link was detected in this message.",
      explanation_en: "Security analysis identified deceptive patterns (such as brand impersonation or unencrypted pathways) designed to steal credentials.",
      action_advice_en: "1. Do not click the link.\n2. Never enter your PIN, OTP, or passwords.\n3. Verify offers exclusively through official apps.",
      banglish_advice: "Ei link-e click korben na. Kono vabei bKash ba Nagad PIN/OTP share korben na. Eta scam hote pare."
    };
  }

  return {
    summary_bn: "✅ প্রাথমিক সুরক্ষায় কোনো পরিচিত হুমকি পাওয়া যায়নি।",
    explanation_bn: "গুগল সেফ ব্রাউজিং এবং লোকাল মেশিন লার্নিং মডেলে কোনো ক্ষতিকর সংকেত মেলেনি। তবে অনলাইনে অপরিচিত লিংকে সতর্ক থাকা উচিত।",
    action_advice_bn: "লিংকটি ব্যবহার করতে পারেন, তবে ব্যক্তিগত তথ্য বা পিন দেওয়ার আগে ওয়েবসাইটের ঠিকানা নিশ্চিত করে নিন।",
    summary_en: "✅ No known threats detected based on current threat lists and local ML checks.",
    explanation_en: "No known threats were found in reputation databases and structural ML features appear typical. Always remain cautious when entering credentials.",
    action_advice_en: "Always double-check the browser address bar before submitting sensitive personal information.",
    banglish_advice: "Kono threat pawa jayni. Tobe kono personal information deyar age domain check kore nin."
  };
}

/**
 * Generates an explainable cyber-safety summary using Google Gemini.
 *
 * @param {object} params
 * @param {string} params.originalMessage - User's input text.
 * @param {string} params.overallVerdict - Composite risk decision (HIGH_RISK, SUSPICIOUS, NEEDS_REVIEW, NO_KNOWN_THREAT).
 * @param {Array<object>} params.urls - Processed URL objects with signals, ML, and Safe Browsing details.
 * @param {string} [params.language="both"] - Target language: "bn", "en", "banglish", or "both".
 * @returns {Promise<object>} Structured explanation object.
 */
export async function generateSafetyExplanation({
  originalMessage,
  overallVerdict,
  urls,
  language = "both"
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return generateFallbackExplanation(overallVerdict, urls);
  }

  const simplifiedUrls = (urls || []).map((u) => ({
    url: u.normalized,
    verdict: u.riskAssessment?.verdict,
    signals: u.signals || [],
    mlRiskProbability: u.ml?.probability !== undefined ? `${(u.ml.probability * 100).toFixed(1)}%` : "N/A",
    safeBrowsingThreats: u.safeBrowsing?.threats || []
  }));

  const prompt = `
You are 'Friend Shield' (ফ্রেন্ড শিল্ড), an empathetic, expert cyber-safety assistant designed to protect everyday internet users from fraud, scam messages, and phishing.

Analyze the user's message and the multi-layer security findings below:

---
User's Message:
"${originalMessage}"

Security Scan Results:
- Overall Verdict: ${overallVerdict}
- Inspected URLs:
${JSON.stringify(simplifiedUrls, null, 2)}
---

Instructions:
1. Explain the danger or safety clearly in everyday language. Do NOT use technical jargon like "heuristics", "entropy", or "SSRF".
2. If brand impersonation (e.g. bKash, Nagad, Upay, Daraz) or lottery/bonus scams are detected, explicitly tell the user to NEVER provide their PIN, OTP, or password.
3. Keep the tone helpful, urgent (if dangerous), and supportive.
4. Format the output strictly as a JSON object with the following keys:
{
  "summary_bn": "খুব সংক্ষিপ্ত এক লাইনে সতর্কবার্তা (বাংলা)",
  "explanation_bn": "কেন এটি ক্ষতিকর বা নিরাপদ তার সহজ পয়েন্ট-ভিত্তিক ব্যাখ্যা (বাংলা)",
  "action_advice_bn": "ব্যবহারকারীর কী করা উচিত এবং কী করা উচিত নয় (বাংলা)",
  "summary_en": "One-line clear summary (English)",
  "explanation_en": "Simple, point-based explanation (English)",
  "action_advice_en": "Clear action advice (English)",
  "banglish_advice": "Short, natural advice in Banglish (Bengali written in English letters, e.g. 'Ei link-e click korben na')"
}
`;

  // Try available models in order of latency
  for (const model of GEMINI_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        }),
        signal: AbortSignal.timeout(12000)
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (rawText) {
        const parsed = JSON.parse(rawText);
        parsed.source = `Gemini AI (${model})`;
        return parsed;
      }
    } catch (err) {
      // Try next model if timeout or network glitch
      continue;
    }
  }

  // Graceful fallback if all models fail or rate-limit
  const fallback = generateFallbackExplanation(overallVerdict, urls);
  fallback.source = "Local Rule-Based Explainer (Offline Fallback)";
  return fallback;
}

export default {
  generateSafetyExplanation
};
