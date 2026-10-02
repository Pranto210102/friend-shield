import { validatePublicHost } from "../utils/ip-validator.js";
import {
  ValidationError,
  RedirectLoopError,
  TooManyRedirectsError,
  RequestTimeoutError,
  UnreachableHostError
} from "../utils/errors.js";

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 6_000;

// Standard browser-like headers to avoid anti-bot/crawler 403 blocks from shortener services
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 FriendShieldBot/1.0",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};

/**
 * Validates protocol, credentials, and SSRF rules for a URL.
 * @param {string} value
 * @returns {Promise<URL>}
 */
async function validateAndParseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError(`Invalid URL format: '${value}'.`);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new ValidationError("Only HTTP and HTTPS URLs are allowed.");
  }

  if (url.username || url.password) {
    throw new ValidationError("URLs containing credentials are not allowed.");
  }

  // SSRF Protection: Check if target resolves to a restricted/private network
  await validatePublicHost(url.hostname);

  return url;
}

/**
 * Dispatches a request to check for redirects.
 * Attempts HEAD first, falls back to GET if HEAD is rejected by the server (e.g. 405, 403).
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function fetchHop(url) {
  let response;

  try {
    response = await fetch(url, {
      method: "HEAD",
      headers: BROWSER_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    // If server rejects HEAD (common on CDNs, Cloudflare, or certain shorteners)
    if (response.status === 405 || response.status === 403 || response.status === 501) {
      response = await fetch(url, {
        method: "GET",
        headers: BROWSER_HEADERS,
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      // Immediately cancel the response stream so body content isn't downloaded
      if (response.body) {
        await response.body.cancel();
      }
    }

    return response;
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new RequestTimeoutError(
        `Request to '${url.hostname}' timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`
      );
    }

    throw new UnreachableHostError(
      `Failed to connect to '${url.hostname}': ${err.message}`
    );
  }
}

/**
 * Resolves all redirect hops for an input URL to find the final landing destination.
 * @param {string} inputUrl
 * @returns {Promise<object>}
 */
export async function resolveRedirects(inputUrl) {
  let currentUrl = await validateAndParseUrl(inputUrl);
  const redirects = [];
  const visitedUrls = new Set();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const currentHref = currentUrl.href;

    if (visitedUrls.has(currentHref)) {
      throw new RedirectLoopError(
        `Redirect loop detected at '${currentHref}'.`
      );
    }

    visitedUrls.add(currentHref);

    const response = await fetchHop(currentUrl);

    if (!REDIRECT_STATUS_CODES.has(response.status)) {
      return {
        originalUrl: inputUrl,
        finalUrl: currentUrl.href,
        status: response.status,
        redirectCount: redirects.length,
        redirects
      };
    }

    const location = response.headers.get("location");

    if (!location) {
      return {
        originalUrl: inputUrl,
        finalUrl: currentUrl.href,
        status: response.status,
        redirectCount: redirects.length,
        redirects
      };
    }

    // Resolve relative or absolute redirect destination
    let nextUrl;
    try {
      nextUrl = new URL(location, currentUrl);
    } catch {
      throw new ValidationError(`Invalid redirect location header: '${location}'.`);
    }

    // SSRF Check for the next hop target
    await validateAndParseUrl(nextUrl.href);

    redirects.push({
      status: response.status,
      from: currentUrl.href,
      to: nextUrl.href
    });

    currentUrl = nextUrl;
  }

  throw new TooManyRedirectsError(MAX_REDIRECTS);
}

export default {
  resolveRedirects
};