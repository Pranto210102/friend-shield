/**
 * Social Engineering Manipulation Index (SEMI) Service
 * Analyzes psychological manipulation tactics across 4 core vectors:
 * 1. Urgency / Panic Induction
 * 2. Financial Bait / Greed
 * 3. Authority Impersonation
 * 4. Credential Coercion
 */

const VECTORS = {
  urgency: {
    name: "Urgency & Panic",
    name_bn: "কৃত্রিম জরুরি অবস্থা ও ভীতি প্রদর্শন",
    weight: 0.30,
    patterns: [
      /immediately/i,
      /urgent(?:ly)?/i,
      /suspend(?:ed)?/i,
      /within\s+\d+\s+(?:hours?|mins?|minutes?)/i,
      /expire[sd]?\s+(?:today|soon)/i,
      /last\s+chance/i,
      /limited\s+time/i,
      /hurry\s+up/i,
      /action\s+required/i,
      /act\s+now/i,
      /terminated?/i,
      /blocked?/i,
      /deactivated?/i,
      /জরুরি/,
      /অবিলম্বে/,
      /আজকের\s*মধ্যে/,
      /বন্ধ\s*হয়ে\s*যাবে/,
      /স্থগিত/,
      /সীমিত\s*সময়/,
      /তাড়াতাড়ি/,
      /শেষ\s*সুযোগ/,
      /এখনই/,
      /ব্লক\s*হয়ে\s*যাবে/,
      /নিষ্ক্রিয়/,
      /ekhoni/i,
      /taratari/i,
      /bondho/i,
      /shomoy\s*sesh/i
    ]
  },
  financialBait: {
    name: "Financial Bait & Greed",
    name_bn: "আর্থিক প্রলোভন ও বোনাসের ফাঁদ",
    weight: 0.35,
    patterns: [
      /bonus(?:es)?/i,
      /won\b/i,
      /lottery/i,
      /cash\s*prize/i,
      /cashback/i,
      /free\s*gift/i,
      /reward[s]?/i,
      /claim\s*(?:now|here)?/i,
      /selected\s+to\s+win/i,
      /guaranteed\s+money/i,
      /congratulations?/i,
      /free\s*recharge/i,
      /বোনাস/,
      /লটারি/,
      /পুরস্কার/,
      /জিতেছেন/,
      /ক্যাশব্যাক/,
      /উপহার/,
      /ক্লেইম/,
      /অভিনন্দন/,
      /ফ্রি\s*রিচার্জ/,
      /টাকা\s*জিতুন/,
      /টাকা\s*পেয়েছেন/,
      /jitechen/i,
      /upohar/i,
      /taka\s*paben/i
    ]
  },
  authorityImpersonation: {
    name: "Authority Impersonation",
    name_bn: "কর্তৃপক্ষের নাম ভাঙিয়ে বিভ্রান্তি",
    weight: 0.20,
    patterns: [
      /bKash\s*(?:support|security|care|office)/i,
      /Nagad\s*(?:support|verification|care)/i,
      /central\s*bank/i,
      /Bangladesh\s*Bank/i,
      /security\s*department/i,
      /customer\s*care/i,
      /fraud\s*prevention/i,
      /account\s*(?:manager|team)/i,
      /official\s*(?:notice|verification)/i,
      /বিকাশ\s*(?:সাপোর্ট|অফিস|হেল্পলাইন)/,
      /নগদ\s*(?:সাপোর্ট|ভেরিফিকেশন)/,
      /বাংলাদেশ\s*ব্যাংক/,
      /সিকিউরিটি\s*বিভাগ/,
      /কাস্টমার\s*কেয়ার/,
      /অফিসিয়াল\s*ভেরিফিকেশন/,
      /হেড\s*অফিস/,
      /bKash\s*care/i,
      /customer\s*care/i
    ]
  },
  credentialCoercion: {
    name: "Credential Coercion",
    name_bn: "গোপন পিন/ওটিপি হাতিয়ে নেওয়ার চেষ্টা",
    weight: 0.40,
    patterns: [
      /enter\s*(?:your)?\s*pin/i,
      /provide\s*(?:your)?\s*otp/i,
      /verify\s*(?:your)?\s*password/i,
      /login\s+to\s+claim/i,
      /update\s*(?:your)?\s*credentials/i,
      /confirm\s*(?:your)?\s*pin/i,
      /share\s*(?:your)?\s*otp/i,
      /submit\s*(?:your)?\s*password/i,
      /account\s*verification/i,
      /পিন\s*(?:দিন|প্রবেশ\s*করুন)/,
      /ওটিপি/,
      /পাসওয়ার্ড\s*(?:দিন|লিখুন)/,
      /লগইন\s*করুন/,
      /তথ্য\s*দিন/,
      /ভেরিফাই\s*করুন/,
      /পিন\s*নিশ্চিত\s*করুন/,
      /pin\s*din/i,
      /otp\s*din/i,
      /password\s*din/i,
      /login\s*korun/i
    ]
  }
};

/**
 * Evaluates the Social Engineering Manipulation Index (SEMI) of a message.
 *
 * @param {string} text - Message text to inspect.
 * @returns {object} Detailed social engineering threat report.
 */
export function analyzeSocialEngineering(text) {
  if (!text || typeof text !== "string") {
    return {
      score: 0,
      riskLevel: "MINIMAL",
      vectorsDetected: 0,
      triggers: [],
      summary: "No social engineering triggers detected."
    };
  }

  const detectedVectors = [];
  let weightedSum = 0;

  for (const [key, vector] of Object.entries(VECTORS)) {
    const matches = [];

    for (const pattern of vector.patterns) {
      const match = text.match(pattern);
      if (match) {
        matches.push(match[0]);
      }
    }

    if (matches.length > 0) {
      const uniqueMatches = Array.from(new Set(matches));
      // Base score for the vector + scaling with repetition up to 100
      const vectorScore = Math.min(100, 50 + uniqueMatches.length * 20);
      weightedSum += vectorScore * vector.weight;

      detectedVectors.push({
        vectorKey: key,
        name: vector.name,
        name_bn: vector.name_bn,
        score: Math.round(vectorScore),
        matches: uniqueMatches
      });
    }
  }

  // Normalization: Clamp to 0 - 100
  const finalScore = Math.min(100, Math.round(weightedSum));

  let riskLevel = "MINIMAL";
  if (finalScore >= 75 || detectedVectors.length >= 3) {
    riskLevel = "CRITICAL";
  } else if (finalScore >= 50 || detectedVectors.length >= 2) {
    riskLevel = "HIGH";
  } else if (finalScore >= 25 || detectedVectors.length >= 1) {
    riskLevel = "MODERATE";
  }

  return {
    score: finalScore,
    riskLevel,
    vectorsDetected: detectedVectors.length,
    vectors: detectedVectors,
    hasUrgency: detectedVectors.some((v) => v.vectorKey === "urgency"),
    hasFinancialBait: detectedVectors.some((v) => v.vectorKey === "financialBait"),
    hasAuthorityImpersonation: detectedVectors.some((v) => v.vectorKey === "authorityImpersonation"),
    hasCredentialCoercion: detectedVectors.some((v) => v.vectorKey === "credentialCoercion")
  };
}

export default {
  analyzeSocialEngineering
};
