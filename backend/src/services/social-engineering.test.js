import { analyzeSocialEngineering } from "./social-engineering.service.js";

console.log("=== Testing Social Engineering Manipulation Index (SEMI) Service ===");

// Test 1: Fake Eid bonus scam message
const scamMessage = "বিকাশ থেকে আপনাকে ১০,০০০ টাকা ঈদ বোনাস দেওয়া হয়েছে! এখনই ক্লেইম করুন: http://bkash-eid-bonus.xyz/claim";
const res1 = analyzeSocialEngineering(scamMessage);
console.log("Test 1 (bKash Scam):", JSON.stringify(res1, null, 2));

if (res1.score < 50 || !res1.hasFinancialBait || !res1.hasUrgency) {
  throw new Error("Test 1 Failed: Scam message should have high social engineering score!");
}
console.log("✓ Test 1 passed: Accurately caught Financial Bait and Urgency.");

// Test 2: Clean legitimate transaction message
const cleanMessage = "You have received Tk 1,500 from 01700000000. Balance Tk 4,500. TrxID 9A72BC61. https://www.bkash.com/offers";
const res2 = analyzeSocialEngineering(cleanMessage);
console.log("Test 2 (Clean Message): Score =", res2.score, "Risk =", res2.riskLevel);

if (res2.score > 20) {
  throw new Error("Test 2 Failed: Legitimate message should not trigger social engineering alarms!");
}
console.log("✓ Test 2 passed: Clean transaction message is MINIMAL risk.");

// Test 3: Credential Coercion + Panic message in English
const panicMessage = "Urgent: Your account has been suspended! Verify your password and provide your OTP immediately within 24 hours.";
const res3 = analyzeSocialEngineering(panicMessage);
console.log("Test 3 (Panic/Credential Scam): Score =", res3.score, "Risk =", res3.riskLevel);

if (!res3.hasCredentialCoercion || !res3.hasUrgency || res3.score < 60) {
  throw new Error("Test 3 Failed: Panic message must trigger Credential Coercion and Urgency!");
}
console.log("✓ Test 3 passed: Credential Coercion & Urgency caught.");

console.log("\nALL 3 SOCIAL ENGINEERING UNIT TESTS PASSED SUCCESSFULLY!");
