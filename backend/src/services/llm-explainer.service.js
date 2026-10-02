/**
 * Service to generate human-friendly, actionable explanations in Bangla, English, and Banglish
 * using Open-Source / Open-Weight Gemma (Local Ollama, Groq Gemma-2, or Google Gemma).
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const GEMMA_LOCAL_MODEL = process.env.GEMMA_MODEL || "gemma2:2b";

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
  const simplifiedUrls = (urls || []).map((u) => ({
    url: u.normalized,
    verdict: u.riskAssessment?.verdict,
    signals: u.signals || [],
    mlRiskProbability: u.ml?.probability !== undefined ? `${(u.ml.probability * 100).toFixed(1)}%` : "N/A",
    safeBrowsingThreats: u.safeBrowsing?.threats || []
  }));

  const currentYear = new Date().getFullYear();
  const isSafe = overallVerdict === "NO_KNOWN_THREAT";
  const isDangerous = overallVerdict === "HIGH_RISK" || overallVerdict === "SUSPICIOUS";

  const prompt = `
You are 'Friend Shield' (ফ্রেন্ড শিল্ড), an expert, empathetic cyber-safety assistant protecting users from online fraud, scams, and deceptive messages.

CONTEXT & TIME:
- The current year is ${currentYear} (e.g. 2025, 2026). Dates with year ${currentYear} are CURRENT and NORMAL; NEVER claim dates from ${currentYear} are "in the future" or "fake dates".
- Multi-Layer Security Engine Verdict: ${overallVerdict}
- Scanned Link Data:
${JSON.stringify(simplifiedUrls, null, 2)}

USER'S MESSAGE:
"""${originalMessage}"""

CRITICAL VERDICT CONSISTENCY RULES:
${
  isSafe
    ? `
- The security engine determined this message has: NO KNOWN THREAT (SAFE / LEGITIMATE).
- It is a genuine transaction confirmation (e.g., bKash, Nagad, or bank SMS with TrxID, balance, cash-in/send money) or a safe message with legitimate official links.
- DO NOT call this message "suspicious" or "phishing"!
- DO NOT say "এই মেসেজটি সন্দেহজনক হতে পারে" or "এটি ভুয়া মেসেজ"!
- Clearly confirm in the summary and explanation that the message appears authentic, legitimate, and safe.
- Point out 1-3 reassuring factors (e.g., legitimate transaction format, no malicious links, official domain).
- Action advice: Confirm the transaction is fine, and provide standard routine security hygiene (e.g., "মেসেজটি নিরাপদ। তবে সতর্কতাস্বরূপ কখনোই কাউকে আপনার বিকাশ/ব্যাংক পিন বা ওটিপি দেবেন না।").
`
    : isDangerous
    ? `
- The security engine determined this message is: ${overallVerdict} (DANGEROUS / SCAM).
- Warn the user clearly and urgently that this is a fraudulent message or scam attempt.
- Point out why (e.g. brand impersonation, unencrypted HTTP, fake lottery/bonus promises, raw IP, suspicious links).
- Strongly urge them NEVER to click the link and NEVER to disclose their PIN, OTP, or password.
`
    : `
- The security engine determined this message: NEEDS REVIEW.
- Explain the cautionary signals detected and advise careful verification before proceeding.
`
}

Output format:
Format strictly as a valid JSON object with the following keys:
{
  "summary_bn": "খুব সংক্ষিপ্ত এক লাইনে ফলাফল (বাংলা)",
  "explanation_bn": "সহজ পয়েন্ট-ভিত্তিক ব্যাখ্যা (১. ..., ২. ...) (বাংলা)",
  "action_advice_bn": "ব্যবহারকারীর কী করা উচিত (বাংলা)",
  "summary_en": "One-line clear summary (English)",
  "explanation_en": "Simple, point-based explanation (English)",
  "action_advice_en": "Clear action advice (English)",
  "banglish_advice": "Short, natural advice in Banglish (Bengali in English alphabet)"
}
`;

  // 1. Tier 1: Try Local Open-Source Gemma 2 via Ollama (100% On-Device Privacy)
  try {
    const ollamaRes = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMMA_LOCAL_MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        format: "json"
      }),
      signal: AbortSignal.timeout(4000) // Fast check for local daemon
    });

    if (ollamaRes.ok) {
      const data = await ollamaRes.json();
      const content = data.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        parsed.source = `Open-Source Gemma 2 (Local Ollama: ${GEMMA_LOCAL_MODEL})`;
        return parsed;
      }
    }
  } catch {}

  // 2. Tier 2: Try Cloud Open-Weight Gemma 2 (via Groq API if configured)
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) {
    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: "gemma2-9b-it",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.2
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          parsed.source = "Open-Source Gemma 2 (gemma2-9b-it via Groq)";
          return parsed;
        }
      }
    } catch {}
  }

  // 3. Tier 3: Try Google Gemma / Gemini API (if GEMINI_API_KEY is configured)
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    const OPEN_MODELS = [
      "gemma-2-9b-it",
      "gemma-2-27b-it",
      "gemini-2.0-flash",
      "gemini-1.5-flash"
    ];

    for (const model of OPEN_MODELS) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2
            }
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) continue;

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          parsed.source = model.startsWith("gemma")
            ? `Google Gemma 2 (${model})`
            : `Google AI (${model})`;
          return parsed;
        }
      } catch {}
    }
  }

  // 4. Tier 4: Local Deterministic Rule-Based Explainer (100% Offline Guaranteed Fallback)
  const fallback = generateFallbackExplanation(overallVerdict, urls);
  fallback.source = "Local Deterministic Explainer (Offline Fallback)";
  return fallback;
}

export default {
  generateSafetyExplanation
};
