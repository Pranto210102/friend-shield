import dns from "node:dns/promises";
import net from "node:net";
import { SsrfBlockedError, UnreachableHostError } from "./errors.js";

/**
 * Converts an IPv4 string to an unsigned 32-bit integer.
 * @param {string} ip
 * @returns {number}
 */
function ipv4ToLong(ip) {
  return ip
    .split(".")
    .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

/**
 * Checks whether an IPv4 address belongs to a private, loopback, or reserved range.
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateOrReservedIpv4(ip) {
  const long = ipv4ToLong(ip);

  // 0.0.0.0/8 (Current network / "this" host)
  if ((long & 0xff000000) >>> 0 === 0x00000000) return true;

  // 10.0.0.0/8 (Private network - RFC 1918)
  if ((long & 0xff000000) >>> 0 === 0x0a000000) return true;

  // 100.64.0.0/10 (Shared Address Space / CGNAT - RFC 6598)
  if ((long & 0xffc00000) >>> 0 === 0x64400000) return true;

  // 127.0.0.0/8 (Loopback - RFC 1122)
  if ((long & 0xff000000) >>> 0 === 0x7f000000) return true;

  // 169.254.0.0/16 (Link Local / Cloud Metadata 169.254.169.254 - RFC 3927)
  if ((long & 0xffff0000) >>> 0 === 0xa9fe0000) return true;

  // 172.16.0.0/12 (Private network - RFC 1918)
  if ((long & 0xfff00000) >>> 0 === 0xac100000) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments - RFC 6890)
  if ((long & 0xffffff00) >>> 0 === 0xc0000000) return true;

  // 192.0.2.0/24 (TEST-NET-1 - RFC 5737)
  if ((long & 0xffffff00) >>> 0 === 0xc0000200) return true;

  // 192.168.0.0/16 (Private network - RFC 1918)
  if ((long & 0xffff0000) >>> 0 === 0xc0a80000) return true;

  // 198.18.0.0/15 (Network Interconnect Benchmark Testing - RFC 2544)
  if ((long & 0xfffe0000) >>> 0 === 0xc6120000) return true;

  // 198.51.100.0/24 (TEST-NET-2 - RFC 5737)
  if ((long & 0xffffff00) >>> 0 === 0xc6336400) return true;

  // 203.0.113.0/24 (TEST-NET-3 - RFC 5737)
  if ((long & 0xffffff00) >>> 0 === 0xcb007100) return true;

  // 224.0.0.0/4 (Multicast - RFC 5771) and 240.0.0.0/4 (Reserved / Future - RFC 1112)
  if ((long >>> 28) >= 14) return true;

  // 255.255.255.255 (Limited Broadcast)
  if (long === 0xffffffff) return true;

  return false;
}

/**
 * Checks whether an IPv6 address belongs to a private, loopback, or reserved range.
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateOrReservedIpv6(ip) {
  const normalized = ip.toLowerCase();

  // ::1 (Loopback) or :: (Unspecified)
  if (normalized === "::1" || normalized === "::") return true;

  // IPv4-mapped IPv6 address (::ffff:w.x.y.z)
  if (normalized.startsWith("::ffff:")) {
    const ipv4 = normalized.replace("::ffff:", "");
    if (net.isIPv4(ipv4)) {
      return isPrivateOrReservedIpv4(ipv4);
    }
  }

  // fe80::/10 (Link-local unicast)
  if (/^fe[89ab][0-9a-f]:/i.test(normalized)) return true;

  // fc00::/7 (Unique local unicast / private)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) return true;

  // ff00::/8 (Multicast)
  if (/^ff[0-9a-f]{2}:/i.test(normalized)) return true;

  return false;
}

/**
 * Checks if an IP is private, loopback, or reserved.
 * @param {string} ip
 * @returns {boolean}
 */
export function isPrivateOrReservedIp(ip) {
  if (net.isIPv4(ip)) return isPrivateOrReservedIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateOrReservedIpv6(ip);
  return true; // Treat unknown address types as unsafe
}

/**
 * Cleans IPv6 brackets from a hostname (e.g. "[::1]" -> "::1").
 * @param {string} hostname
 * @returns {string}
 */
export function cleanHostname(hostname) {
  return hostname.replace(/^\[|\]$/g, "").trim();
}

/**
 * Validates that a hostname/IP is safe for outbound requests (guards against SSRF).
 * Resolves DNS to check all associated IP addresses.
 * @param {string} hostname
 * @throws {SsrfBlockedError} If hostname or resolved IP is local/private/reserved.
 * @throws {UnreachableHostError} If hostname cannot be resolved.
 */
export async function validatePublicHost(hostname) {
  const cleaned = cleanHostname(hostname);

  if (!cleaned) {
    throw new SsrfBlockedError("Hostname cannot be empty.");
  }

  // Check if it's already an IP address
  if (net.isIP(cleaned)) {
    if (isPrivateOrReservedIp(cleaned)) {
      throw new SsrfBlockedError(`Access to restricted IP address '${cleaned}' is blocked.`);
    }
    return;
  }

  // Common quick checks for localhost variants
  if (cleaned === "localhost" || cleaned.endsWith(".localhost") || cleaned.endsWith(".local") || cleaned.endsWith(".internal")) {
    throw new SsrfBlockedError(`Access to local hostname '${cleaned}' is blocked.`);
  }

  // Resolve DNS to verify all target IPs
  let records;
  try {
    records = await dns.lookup(cleaned, { all: true });
  } catch (err) {
    throw new UnreachableHostError(`Host '${cleaned}' could not be resolved: ${err.message}`);
  }

  if (!records || records.length === 0) {
    throw new UnreachableHostError(`No DNS records found for host '${cleaned}'.`);
  }

  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new SsrfBlockedError(`Target host '${cleaned}' resolves to a restricted network address (${record.address}).`);
    }
  }
}
