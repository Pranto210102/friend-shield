/**
 * Service to generate human-friendly, actionable explanations in Bangla, English, and Banglish
 * using Open-Source / Open-Weight Google Gemma 2 (Groq Cloud Inference or Local Ollama).
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const GEMMA_LOCAL_MODEL = process.env.GEMMA_MODEL || "gemma2:2b";

/**
 * Robust JSON parser that handles pure JSON, markdown fences, and stray text.
 */
function extractAndParseJson(text) {
  if (!text || typeof text !== "string") return null;

  // 1. Direct parse attempt
  try {
    return JSON.parse(text.trim());
  } catch {}

  // 2. Extract from markdown code fences ```json ... ``` or ``` ... ```
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1].trim());
    } catch {}
  }

  // 3. Find outer braces { ... }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}

const REQUIRED_EXPLANATION_KEYS = [
  "summary_bn",
  "explanation_bn",
  "action_advice_bn",
  "summary_en",
  "explanation_en",
  "action_advice_en",
  "summary_banglish",
  "explanation_banglish",
  "action_advice_banglish"
];

/**
 * Validates that an LLM response contains all required fields,
 * conforms to length boundaries, and contains no structural corruption.
 */
function validateExplanationPayload(obj) {
  if (!obj || typeof obj !== "object") return null;

  for (const key of REQUIRED_EXPLANATION_KEYS) {
    if (typeof obj[key] !== "string" || obj[key].trim().length === 0) {
      return null; // Missing or non-string field -> trigger deterministic fallback
    }
    // Hard ceiling to prevent token runaway
    if (obj[key].length > 1200) {
      obj[key] = obj[key].substring(0, 1200) + "...";
    }
  }

  return obj;
}

/**
 * Fallback template generator when LLM is unavailable or offline.
 */
function generateFallbackExplanation(overallVerdict, urls) {
  const isHighRisk = overallVerdict === "HIGH_RISK" || overallVerdict === "SUSPICIOUS";
  const noUrls = !urls || urls.length === 0;

  if (isHighRisk) {
    if (noUrls) {
      return {
        summary_bn: "⚠️ উচ্চ সতর্কতা! এই মেসেজটিতে স্ক্যাম বা জালিয়াতির লক্ষণ রয়েছে।",
        explanation_bn: "১. মেসেজটিতে সন্দেহজনক আর্থিক প্রলোভন বা জরুরি অবস্থার ভীতি দেখানো হয়েছে।\n২. এটি একটি পরিচিত স্ক্যাম বা প্রতারণার ধরন হতে পারে।",
        action_advice_bn: "১. নির্দেশিত কাজ করবেন না।\n২. আপনার পিন, ওটিপি বা পাসওয়ার্ড কারো সাথে শেয়ার করবেন না।",
        summary_en: "⚠️ High Risk! This message contains strong social engineering scam indicators.",
        explanation_en: "1. The message uses manipulative psychological tactics like financial bait or false urgency.\n2. This matches known patterns of fraudulent communications.",
        action_advice_en: "1. Do not follow the message instructions.\n2. Never enter or share your PIN, OTP, or passwords.",
        summary_banglish: "⚠️ High Risk! Ei message-e scam ba deception er lokkhon pawa geche.",
        explanation_banglish: "1. Message-ti te suspicious financial offer ba bhoy dekhano hoyeche.\n2. Eta ekta fake ba scam text hote pare.",
        action_advice_banglish: "1. Tader kotha shunben na.\n2. Apnar PIN ba OTP karo sathe share korben na.",
        banglish_advice: "Kono vabei apnar PIN ba OTP share korben na."
      };
    }
    return {
      summary_bn: "⚠️ উচ্চ সতর্কতা! এই লিংকটিতে ফিশিং ও জালিয়াতির শক্তিশালী ঝুঁকি রয়েছে।",
      explanation_bn: "১. আমাদের নিরাপত্তা বিশ্লেষণ অনুযায়ী এই লিংকটিতে ব্র্যান্ড অনুকরণ বা ক্ষতিকর কাঠামো শনাক্ত হয়েছে।\n২. লিংকটি HTTP ব্যবহার করে, তাই এতে পাঠানো তথ্য সুরক্ষিতভাবে encrypted নাও থাকতে পারে।",
      action_advice_bn: "১. কোনো অবস্থাতেই এই লিংকে ক্লিক করবেন না।\n২. আপনার বিকাশ/নগদ পিন, ওটিপি বা পাসওয়ার্ড কারো সাথে শেয়ার করবেন না।",
      summary_en: "⚠️ High Risk! This link contains strong phishing and deception indicators.",
      explanation_en: "1. Security analysis identified deceptive patterns (such as brand impersonation) that do not match official domains.\n2. The link uses unencrypted HTTP, so information submitted through it is not protected in transit.",
      action_advice_en: "1. Do not click or open this link.\n2. Never enter your PIN, OTP, or passwords.\n3. Verify offers exclusively through official apps.",
      summary_banglish: "⚠️ High Risk! Ei link-e strong phishing indicators pawa geche, click korben na.",
      explanation_banglish: "1. Link-ti official domain noy, eta brand impersonation er moto deceptive pattern.\n2. Link-ti unencrypted HTTP use korche, tai internet-e information protected thakbe na.",
      action_advice_banglish: "1. Kono vabei ei link-e click korben na.\n2. Apnar bKash ba Nagad PIN/OTP karo sathe share korben na.\n3. Shob offer shudhumatro official app theke verify korun.",
      banglish_advice: "Ei link-e click korben na. Kono vabei bKash ba Nagad PIN/OTP share korben na."
    };
  }

  return {
    summary_bn: "✅ প্রাথমিক সুরক্ষায় কোনো পরিচিত হুমকি পাওয়া যায়নি।",
    explanation_bn: "১. গুগল সেফ ব্রাউজিং এবং লোকাল স্ক্যানিং-এ কোনো ক্ষতিকর সংকেত মেলেনি।\n২. বার্তাটি সাধারণ এবং স্বাভাবিক লেনদেন বা বার্তার মতো দেখাচ্ছে।",
    action_advice_bn: "ব্যক্তিগত তথ্য বা পিন দেওয়ার আগে সতর্ক থাকুন।",
    summary_en: "✅ No known threats detected based on current threat lists and local checks.",
    explanation_en: "1. No known threats were found in reputation databases and features appear typical.\n2. The message structure matches expected patterns.",
    action_advice_en: "Always double-check before submitting sensitive personal information.",
    summary_banglish: "✅ Kono porichito threat ba risk pawa jayni.",
    explanation_banglish: "1. Model-e kono bipod ba risk pawa jayni.\n2. Message-ti shamogrik vabe safe ebong authentic mone hocche.",
    action_advice_banglish: "Personal information ba PIN deyar age shob kichu check kore nin.",
    banglish_advice: "Kono threat pawa jayni. Tobe kono personal information deyar age check kore nin."
  };
}

/**
 * Generates an explainable cyber-safety summary using Open-Source LLMs.
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
  socialEngineering = null,
  language = "both"
}) {
  const simplifiedUrls = (urls || []).map((u) => ({
    url: u.normalized,
    verdict: u.riskAssessment?.verdict,
    signals: u.signals || [],
    mlRiskProbability: u.ml?.phishingProbability !== undefined ? `${(u.ml.phishingProbability * 100).toFixed(1)}%` : "N/A",
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
- Social Engineering Manipulation Index: ${socialEngineering ? `${socialEngineering.riskLevel} (Score: ${socialEngineering.score}/100)` : "N/A"}
- Psychological Vectors Detected:
${JSON.stringify(socialEngineering?.vectors || [], null, 2)}
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
- Clearly confirm in the summary and explanation that no known threats were found.
- Point out 1-3 reassuring factors (e.g., legitimate transaction format, no malicious links, official domain).
- Action advice: Confirm the transaction looks typical, and provide standard routine security hygiene (e.g., "মেসেজটি নিরাপদ দেখাচ্ছে। তবে সতর্কতাস্বরূপ কখনোই কাউকে আপনার বিকাশ/ব্যাংক পিন বা ওটিপি দেবেন না।").
`
    : isDangerous
    ? `
- The security engine determined this message is: ${overallVerdict} (STRONG RISK INDICATORS).
- State that this message/link contains strong phishing or deception indicators (e.g. brand impersonation, unencrypted HTTP, suspicious structural signals).
- For unencrypted HTTP: State accurately that the link uses HTTP, so information submitted through it is not protected in transit (ইন্টারনেটে তথ্য সুরক্ষিতভাবে encrypted নাও থাকতে পারে).
- Strongly urge the user NEVER to click the link and NEVER to disclose their PIN, OTP, or password.
`
    : `
- The security engine determined this message: NEEDS REVIEW.
- Explain the cautionary signals detected and advise careful verification before proceeding.
`
}

Output format:
Format strictly as a valid JSON object with the following keys. IMPORTANT: For all "banglish" keys, you MUST write natural Bengali using ONLY English/Latin alphabet. NEVER use Bengali script characters in any banglish fields:
{
  "summary_bn": "খুব সংক্ষিপ্ত এক লাইনে ফলাফল (বাংলা)",
  "explanation_bn": "সহজ পয়েন্ট-ভিত্তিক ব্যাখ্যা (১. ..., ২. ...) (বাংলা)",
  "action_advice_bn": "ব্যবহারকারীর কী করা উচিত (বাংলা)",
  "summary_en": "One-line clear summary (English)",
  "explanation_en": "Simple, point-based explanation (English)",
  "action_advice_en": "Clear action advice (English)",
  "summary_banglish": "One-line clear summary entirely in natural Banglish (Bengali written in English alphabet, e.g. 'Eta ekta biphodjjonok fake scam link, konovabei click korben na.')",
  "explanation_banglish": "Point-based explanation entirely in natural Banglish (Bengali written in English alphabet, e.g. '1. Link-ti official domain noy.\\n2. Fake bonus er kotha bole taka churi korar chesta.\\n3. Link-ti secure noy tai password churi hote pare.')",
  "action_advice_banglish": "Action advice entirely in natural Banglish (Bengali written in English alphabet, e.g. '1. Kono vabei link-e click korben na.\\n2. bKash ba Nagad PIN/OTP karo sathe share korben na.\\n3. Message-ti report kore delete kore din.')",
  "banglish_advice": "Short advice in Banglish"
}
`;

  // 1. Tier 1: Cloud Google Gemma 2 Inference (via Groq Cloud LPU or OpenAI-Compatible Gemma Endpoint)
  const apiKey = process.env.GEMMA_API_KEY || process.env.GROQ_API_KEY;
  const apiBase = process.env.GEMMA_API_BASE || "https://api.groq.com/openai/v1";

  if (apiKey && apiKey.trim()) {
    const candidateModels = [
      process.env.GEMMA_MODEL,
      "gemma2-9b-it",
      "google/gemma-2-9b-it",
      "gemma-2-9b-it",
      "gemma-2-27b-it"
    ].filter(Boolean);

    for (const model of candidateModels) {
      try {
        const groqRes = await fetch(`${apiBase}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey.trim()}`
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: "You are Friend Shield (ফ্রেন্ড শিল্ড), an empathetic cyber-safety assistant powered by Google Gemma 2. You MUST respond with ONLY a valid, parseable JSON object matching the requested schema."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          const content = data.choices?.[0]?.message?.content;
          const parsed = extractAndParseJson(content);
          const validated = validateExplanationPayload(parsed);
          if (validated) {
            validated.source = `Google Gemma 2 (${model} via Cloud Inference)`;
            return validated;
          }
        } else {
          const errData = await groqRes.json().catch(() => ({}));
          console.warn(`[Gemma Cloud ${model}] Warning:`, errData?.error?.message || groqRes.statusText);
        }
      } catch (err) {
        console.warn(`[Gemma Cloud ${model}] Request error:`, err.message);
      }
    }
  }

  // 2. Tier 2: Local Google Gemma 2 via Ollama (100% On-Device Local Privacy)
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
      const parsed = extractAndParseJson(content);
      const validated = validateExplanationPayload(parsed);
      if (validated) {
        validated.source = `Google Gemma 2 (Local Ollama: ${GEMMA_LOCAL_MODEL})`;
        return validated;
      }
    }
  } catch {}

  // 3. Tier 3: Local Deterministic Rule-Based Explainer (100% Offline Guaranteed Fallback)
  const fallback = generateFallbackExplanation(overallVerdict, urls);
  fallback.source = "Deterministic fallback template (Gemma unavailable)";
  return fallback;
}

export default {
  generateSafetyExplanation
};
