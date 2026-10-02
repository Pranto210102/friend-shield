import net from "node:net";

const KNOWN_SHORTENERS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "is.gd",
  "buff.ly",
  "ow.ly",
  "rebrand.ly",
  "cutt.ly",
  "shorturl.at"
]);

const SPECIAL_CHARS = ["=", "&", "%", "?", "_", "~", "#", "@"];

// High-risk keywords often present in phishing paths/queries
const SUSPICIOUS_KEYWORDS = [
  "login",
  "verify",
  "verification",
  "signin",
  "account",
  "security",
  "update",
  "banking",
  "confirm",
  "password",
  "credential",
  "wallet",
  "otp",
  "bonus",
  "claim"
];

import fs from "node:fs";

// Load verified brand registry with audit dates and official sources
const brandConfigPath = new URL("../config/mfs-brands.json", import.meta.url);
export const BRAND_REGISTRY = JSON.parse(fs.readFileSync(brandConfigPath, "utf-8"));

const KNOWN_BRANDS = Object.entries(BRAND_REGISTRY).map(([name, cfg]) => ({
  name,
  pattern: new RegExp(cfg.brandKeywords.join("|"), "i"),
  officialDomains: cfg.officialDomains,
  primaryDomain: cfg.officialDomains[0],
  source: cfg.source,
  lastVerified: cfg.lastVerified
}));

export const TRUSTED_DOMAINS = new Set([
  // Bangladeshi MFS, Central & Commercial Banks
  "bkash.com",
  "nagad.com.bd",
  "upaybd.com",
  "rocket.com.bd",
  "bb.org.bd",
  "bracbank.com",
  "dutchbanglabank.com",
  "citybankonline.com",
  "ebl.com.bd",
  "islamibankbd.com",
  "ucb.com.bd",
  "primebank.com.bd",

  // Bangladeshi Government, Statutory Bodies & Public Services
  "bangladesh.gov.bd",
  "nbr.gov.bd",
  "btrc.gov.bd",
  "police.gov.bd",
  "educationboardresults.gov.bd",
  "passport.gov.bd",
  "nidw.gov.bd",
  "dgshs.gov.bd",
  "epassport.gov.bd",

  // Bangladeshi Telecom Operators
  "grameenphone.com",
  "banglalink.net",
  "robi.com.bd",
  "teletalk.com.bd",

  // Leading Bangladeshi E-Commerce, Logistics & Tech Platforms
  "daraz.com.bd",
  "chaldal.com",
  "rokomari.com",
  "pickaboo.com",
  "pathao.com",
  "shohoz.com",
  "shwapno.com",

  // Bangladeshi Public & Private Universities
  "du.ac.bd",
  "buet.ac.bd",
  "ru.ac.bd",
  "nsu.edu",
  "bracu.ac.bd",
  "aiub.edu",

  // Leading Bangladeshi News Media
  "prothomalo.com",
  "thedailystar.net",
  "bdnews24.com",
  "dhakatribune.com",
  "jugantor.com",
  "kalerkantho.com",

  // Global Trusted Platforms
  "google.com",
  "youtube.com",
  "github.com",
  "wikipedia.org",
  "microsoft.com",
  "apple.com",
  "paypal.com",
  "facebook.com",
  "linkedin.com",
  "netflix.com",
  "twitter.com",
  "x.com",
  "stackoverflow.com",
  "amazon.com",
  "mozilla.org",
  "w3schools.com"
]);

export function isRecognizedLegitimateDomain(hostname) {
  if (!hostname) return false;
  const clean = hostname.toLowerCase().replace(/^www\./, "");
  
  // Direct government (.gov.bd) and accredited academic (.ac.bd) TLD verification
  if (clean.endsWith(".gov.bd") || clean.endsWith(".ac.bd")) {
    return true;
  }

  for (const domain of TRUSTED_DOMAINS) {
    if (clean === domain || clean.endsWith(`.${domain}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a hostname is an IPv4 or IPv6 address.
 * @param {string} hostname
 * @returns {boolean}
 */
function isIpAddress(hostname) {
  if (!hostname) return false;
  const clean = hostname.replace(/^\[|\]$/g, "");
  return net.isIP(clean) !== 0;
}

/**
 * Counts subdomains in a hostname.
 * @param {string} hostname
 * @returns {number}
 */
function countSubdomains(hostname) {
  if (!hostname || isIpAddress(hostname)) return 0;
  const parts = hostname.split(".");
  // e.g. example.com has 2 parts -> 0 subdomains
  // sub.example.com has 3 parts -> 1 subdomain
  return Math.max(0, parts.length - 2);
}

/**
 * Extracts the 17 numeric features and human-readable security signals from a URL.
 * Pure function: does NOT perform network calls, Safe Browsing lookups, or LLM prompts.
 *
 * @param {string} urlString - Target URL string.
 * @param {object} [redirectInfo] - Optional redirect metadata.
 * @param {number} [redirectInfo.redirectCount=0] - Number of redirect hops.
 * @param {string} [redirectInfo.originalUrl] - Original URL before redirects.
 * @param {string} [redirectInfo.finalUrl] - Destination URL after redirects.
 * @returns {{ features: number[], featureMap: Record<string, number>, signals: string[] }}
 */
export function extractUrlFeatures(urlString, redirectInfo = {}) {
  let url;
  try {
    const candidate = urlString.startsWith("http://") || urlString.startsWith("https://")
      ? urlString
      : `http://${urlString}`;
    url = new URL(candidate);
  } catch {
    throw new Error(`Invalid URL provided for feature extraction: '${urlString}'`);
  }

  const hostname = (url.hostname || "").toLowerCase();
  const pathname = url.pathname || "";
  const query = (url.search || "").replace(/^\?/, "");
  const fullUrl = url.href;

  const {
    redirectCount = 0,
    originalUrl = null,
    finalUrl = null
  } = redirectInfo;

  // Domain change detection
  let domainChanged = 0;
  if (originalUrl && finalUrl) {
    try {
      const origHost = new URL(originalUrl).hostname.toLowerCase();
      const finalHost = new URL(finalUrl).hostname.toLowerCase();
      if (origHost !== finalHost) {
        domainChanged = 1;
      }
    } catch {}
  }

  // HTTPS downgrade detection
  let httpsDowngrade = 0;
  if (originalUrl && finalUrl) {
    try {
      const origProtocol = new URL(originalUrl).protocol;
      const finalProtocol = new URL(finalUrl).protocol;
      if (origProtocol === "https:" && finalProtocol === "http:") {
        httpsDowngrade = 1;
      }
    } catch {}
  }

  // 17 Numerical features
  const url_length = fullUrl.length;
  const hostname_length = hostname.length;
  const pathname_length = pathname.length;
  const query_length = query.length;
  const number_of_dots = (fullUrl.match(/\./g) || []).length;
  const number_of_hyphens = (fullUrl.match(/-/g) || []).length;
  const number_of_digits = (fullUrl.match(/\d/g) || []).length;
  const number_of_special_characters = SPECIAL_CHARS.reduce(
    (count, char) => count + (fullUrl.split(char).length - 1),
    0
  );
  const number_of_subdomains = countSubdomains(hostname);
  const has_ip_address = isIpAddress(hostname) ? 1 : 0;
  const has_at_symbol = fullUrl.includes("@") ? 1 : 0;
  const has_punycode = (hostname.startsWith("xn--") || hostname.includes(".xn--")) ? 1 : 0;
  const has_https = url.protocol === "https:" ? 1 : 0;
  const has_shortener = (KNOWN_SHORTENERS.has(hostname) || [...KNOWN_SHORTENERS].some(s => hostname.endsWith(`.${s}`))) ? 1 : 0;
  const redirect_count = Number(redirectCount) || 0;
  const domain_changed = domainChanged;
  const https_downgrade = httpsDowngrade;

  // Fixed order matching feature-schema.json
  const features = [
    url_length,
    hostname_length,
    pathname_length,
    query_length,
    number_of_dots,
    number_of_hyphens,
    number_of_digits,
    number_of_special_characters,
    number_of_subdomains,
    has_ip_address,
    has_at_symbol,
    has_punycode,
    has_https,
    has_shortener,
    redirect_count,
    domain_changed,
    https_downgrade
  ];

  const featureMap = {
    url_length,
    hostname_length,
    pathname_length,
    query_length,
    number_of_dots,
    number_of_hyphens,
    number_of_digits,
    number_of_special_characters,
    number_of_subdomains,
    has_ip_address,
    has_at_symbol,
    has_punycode,
    has_https,
    has_shortener,
    redirect_count,
    domain_changed,
    https_downgrade
  };

  // Deterministic, human-readable security signals
  const signals = [];

  if (has_ip_address === 1) {
    signals.push("The URL uses a raw IP address instead of a domain name.");
  }
  if (has_at_symbol === 1) {
    signals.push("The URL contains an '@' symbol, which can disguise the true destination.");
  }
  if (has_punycode === 1) {
    signals.push("The domain uses Punycode (IDN), a technique often used for lookalike brand spoofing.");
  }
  if (has_shortener === 1) {
    signals.push("The URL uses a link shortener that masks the real destination.");
  }
  if (number_of_subdomains >= 3) {
    signals.push(`The domain has an unusually high number of subdomains (${number_of_subdomains}).`);
  }
  if (domain_changed === 1) {
    signals.push("The destination domain changed after redirecting.");
  }
  if (https_downgrade === 1) {
    signals.push("The connection downgraded from secure HTTPS to unencrypted HTTP during redirection.");
  }
  if (has_https === 0) {
    signals.push("The connection is unencrypted (HTTP).");
  }

  // Check for suspicious login / credential keywords
  const matchedKeywords = SUSPICIOUS_KEYWORDS.filter((kw) =>
    pathname.toLowerCase().includes(kw) || query.toLowerCase().includes(kw)
  );
  if (matchedKeywords.length > 0) {
    signals.push(`The URL path or query contains sensitive keywords: [${matchedKeywords.join(", ")}].`);
  }

  for (const b of KNOWN_BRANDS) {
    if (b.pattern.test(fullUrl)) {
      const isLegit = b.officialDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
      if (!isLegit) {
        signals.push(
          `Brand impersonation detected: The URL mimics '${b.name}', but does not belong to the verified official domain '${b.primaryDomain}'.`
        );
      }
    }
  }

  return {
    features,
    featureMap,
    signals
  };
}

export default {
  extractUrlFeatures
};
