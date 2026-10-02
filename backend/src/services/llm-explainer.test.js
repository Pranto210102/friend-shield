import "dotenv/config";
import { generateSafetyExplanation } from "./llm-explainer.service.js";

async function run() {
  console.log("=== Testing Gemini Explainer Service ===");

  const fakeMessage = "বিকাশ থেকে আপনাকে ১০,০০০ টাকা বোনাস দেওয়া হয়েছে! এখনই ক্লেইম করুন: http://bkash-eid-bonus.xyz/claim";
  const fakeUrls = [
    {
      normalized: "http://bkash-eid-bonus.xyz/claim",
      riskAssessment: { verdict: "HIGH_RISK" },
      signals: [
        "The connection is unencrypted (HTTP).",
        "The URL path or query contains sensitive keywords: [claim].",
        "Brand impersonation detected: The URL mimics 'bKash', but does not belong to the official 'bkash.com' domain."
      ],
      ml: { probability: 0.863 },
      safeBrowsing: { isSafe: true, threats: [] }
    }
  ];

  const t0 = performance.now();
  const explanation = await generateSafetyExplanation({
    originalMessage: fakeMessage,
    overallVerdict: "HIGH_RISK",
    urls: fakeUrls
  });

  const duration = (performance.now() - t0).toFixed(0);
  console.log(`Generated explanation in ${duration} ms (Source: ${explanation?.source}):`);
  console.log(JSON.stringify(explanation, null, 2));
}

run().catch(console.error);
