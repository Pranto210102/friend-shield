const SAFE_BROWSING_API_URL =
  "https://safebrowsing.googleapis.com/v4/threatMatches:find";

const THREAT_TYPES = [
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE",
  "POTENTIALLY_HARMFUL_APPLICATION"
];

const PLATFORM_TYPES = ["ANY_PLATFORM"];
const THREAT_ENTRY_TYPES = ["URL"];

/**
 * Checks a list of URLs against Google Safe Browsing API v4.
 * @param {string[]} urls - Array of URL strings to check.
 * @returns {Promise<Map<string, { isSafe: boolean, threats: Array<{ threatType: string, platformType: string }> }>>}
 */
export async function checkUrlsSafety(urls) {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY;

  if (!apiKey) {
    throw new Error(
      "GOOGLE_SAFE_BROWSING_KEY is not configured in environment variables."
    );
  }

  if (!Array.isArray(urls) || urls.length === 0) {
    return new Map();
  }

  // Deduplicate and filter out non-string or empty URLs
  const uniqueUrls = [...new Set(urls.filter((u) => typeof u === "string" && u.trim().length > 0))];

  if (uniqueUrls.length === 0) {
    return new Map();
  }

  const payload = {
    client: {
      clientId: "friend-shield-backend",
      clientVersion: "1.0.0"
    },
    threatInfo: {
      threatTypes: THREAT_TYPES,
      platformTypes: PLATFORM_TYPES,
      threatEntryTypes: THREAT_ENTRY_TYPES,
      threatEntries: uniqueUrls.map((url) => ({ url }))
    }
  };

  const response = await fetch(`${SAFE_BROWSING_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google Safe Browsing API error (HTTP ${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  const matches = data.matches ?? [];

  // Initialize all requested URLs as safe by default
  const results = new Map();
  for (const url of uniqueUrls) {
    results.set(url, {
      isSafe: true,
      threats: []
    });
  }

  // Populate detected threats
  for (const match of matches) {
    const matchedUrl = match.threat?.url;
    if (matchedUrl && results.has(matchedUrl)) {
      const entry = results.get(matchedUrl);
      entry.isSafe = false;
      entry.threats.push({
        threatType: match.threatType,
        platformType: match.platformType,
        cacheDuration: match.cacheDuration
      });
    }
  }

  return results;
}

/**
 * Checks a single URL against Google Safe Browsing API.
 * @param {string} url
 * @returns {Promise<{ isSafe: boolean, threats: Array<{ threatType: string, platformType: string }> }>}
 */
export async function checkSingleUrlSafety(url) {
  const map = await checkUrlsSafety([url]);
  return map.get(url) ?? { isSafe: true, threats: [] };
}

export default {
  checkUrlsSafety,
  checkSingleUrlSafety
};
