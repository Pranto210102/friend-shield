const URL_CANDIDATE_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'`]+|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b[^\s<>"'`]*/gi;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Trims leading and trailing punctuation and handles unbalanced delimiters
 * (such as URLs enclosed in parentheses or markdown brackets in chat messages).
 * Preserves balanced parentheses in valid URLs (e.g., Wikipedia URLs).
 * @param {string} candidate
 * @returns {string}
 */
export function cleanUrlCandidate(candidate) {
  let str = candidate;

  // Strip leading punctuation and quotes: (, [, <, ", ', `
  str = str.replace(/^[([<"'`]+/u, "");

  // Strip standard trailing punctuation
  str = str.replace(/[.,!?;:]+$/u, "");

  // Handle unbalanced closing parentheses (e.g. text containing "(https://example.com)")
  while (str.endsWith(")")) {
    const openCount = (str.match(/\(/g) || []).length;
    const closeCount = (str.match(/\)/g) || []).length;
    if (closeCount > openCount) {
      str = str.slice(0, -1);
      str = str.replace(/[.,!?;:]+$/u, "");
    } else {
      break;
    }
  }

  // Handle unbalanced closing brackets (e.g. markdown "[text](https://example.com)")
  while (str.endsWith("]")) {
    const openCount = (str.match(/\[/g) || []).length;
    const closeCount = (str.match(/\]/g) || []).length;
    if (closeCount > openCount) {
      str = str.slice(0, -1);
      str = str.replace(/[.,!?;:]+$/u, "");
    } else {
      break;
    }
  }

  return str;
}

/**
 * Parses and normalizes a candidate string into a detailed URL structure.
 * @param {string} candidate
 * @returns {object|null}
 */
export function parseUrlCandidate(candidate) {
  const cleaned = cleanUrlCandidate(candidate);

  if (!cleaned) {
    return null;
  }

  let value = cleaned;
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  try {
    const url = new URL(value);

    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      return null;
    }

    if (!url.hostname) {
      return null;
    }

    // Flag Internationalized Domain Names (IDN) / Punycode (often used in phishing)
    const isPunycode =
      url.hostname.startsWith("xn--") || url.hostname.includes(".xn--");

    return {
      original: candidate,
      normalized: url.href,
      protocol: url.protocol,
      hostname: url.hostname,
      isPunycode,
      port: url.port ? Number(url.port) : null,
      pathname: url.pathname || "/",
      search: url.search || null,
      searchParams: Object.fromEntries(url.searchParams.entries()),
      hash: url.hash || null
    };
  } catch {
    return null;
  }
}

/**
 * Extracts all unique URLs from a text message.
 * @param {string} message
 * @returns {Array<object>}
 */
export function extractUrlsFromMessage(message) {
  if (!message || typeof message !== "string") {
    return [];
  }

  const candidates = message.match(URL_CANDIDATE_PATTERN) ?? [];
  const parsedUrls = candidates.map(parseUrlCandidate).filter(Boolean);

  const uniqueUrls = new Map();

  for (const item of parsedUrls) {
    if (!uniqueUrls.has(item.normalized)) {
      uniqueUrls.set(item.normalized, item);
    }
  }

  return [...uniqueUrls.values()];
}

export default {
  cleanUrlCandidate,
  parseUrlCandidate,
  extractUrlsFromMessage
};