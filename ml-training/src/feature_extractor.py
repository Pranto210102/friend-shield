import ipaddress
import re
from urllib.parse import urlparse

KNOWN_SHORTENERS = {
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
}

SPECIAL_CHARS = ["=", "&", "%", "?", "_", "~", "#", "@"]

def is_ip_address(hostname: str) -> bool:
    if not hostname:
        return False
    clean_host = hostname.strip("[]").split(":")[0]
    try:
        ipaddress.ip_address(clean_host)
        return True
    except (ValueError, Exception):
        return False

def count_subdomains(hostname: str) -> int:
    if not hostname or is_ip_address(hostname):
        return 0
    parts = [p for p in hostname.split(".") if p]
    return max(0, len(parts) - 2)

def extract_features(
    url: str,
    redirect_count: int = 0,
    domain_changed: int = 0,
    https_downgrade: int = 0,
    original_url: str = None,
    final_url: str = None
) -> list:
    """
    Extracts the exact 17 numeric features defined in feature-schema.json.
    Returns a list of numbers in the fixed schema order.
    """
    if original_url and final_url:
        try:
            orig_host = (urlparse(original_url if original_url.startswith(("http://", "https://")) else "http://" + original_url).hostname or "").lower()
            fin_host = (urlparse(final_url if final_url.startswith(("http://", "https://")) else "http://" + final_url).hostname or "").lower()
            if orig_host and fin_host and orig_host != fin_host:
                domain_changed = 1
            orig_scheme = urlparse(original_url).scheme
            fin_scheme = urlparse(final_url).scheme
            if orig_scheme == "https" and fin_scheme == "http":
                https_downgrade = 1
        except Exception:
            pass

    if not url.startswith(("http://", "https://")):
        url = "http://" + url

    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower()
        pathname = parsed.path or ""
        query = parsed.query or ""
        scheme = parsed.scheme or "http"
    except Exception:
        # Safe fallback for severely malformed/corrupted URL rows
        clean = url.split("://", 1)[-1]
        host_part = clean.split("/")[0].split("?")[0]
        hostname = host_part.lower()
        pathname = ("/" + clean.split("/", 1)[1].split("?")[0]) if "/" in clean else ""
        query = clean.split("?", 1)[1] if "?" in clean else ""
        scheme = "https" if url.startswith("https://") else "http"

    # Feature 1: url_length
    f_url_length = len(url)

    # Feature 2: hostname_length
    f_hostname_length = len(hostname)

    # Feature 3: pathname_length
    f_pathname_length = len(pathname)

    # Feature 4: query_length
    f_query_length = len(query)

    # Feature 5: number_of_dots
    f_number_of_dots = url.count(".")

    # Feature 6: number_of_hyphens
    f_number_of_hyphens = url.count("-")

    # Feature 7: number_of_digits
    f_number_of_digits = sum(1 for c in url if c.isdigit())

    # Feature 8: number_of_special_characters
    f_number_of_special_characters = sum(url.count(c) for c in SPECIAL_CHARS)

    # Feature 9: number_of_subdomains
    f_number_of_subdomains = count_subdomains(hostname)

    # Feature 10: has_ip_address
    f_has_ip_address = 1 if is_ip_address(hostname) else 0

    # Feature 11: has_at_symbol
    f_has_at_symbol = 1 if "@" in url else 0

    # Feature 12: has_punycode
    f_has_punycode = 1 if "xn--" in hostname else 0

    # Feature 13: has_https
    f_has_https = 1 if scheme == "https" else 0

    # Feature 14: has_shortener
    f_has_shortener = 1 if hostname in KNOWN_SHORTENERS or any(hostname.endswith("." + s) for s in KNOWN_SHORTENERS) else 0

    # Feature 15: redirect_count
    f_redirect_count = int(redirect_count)

    # Feature 16: domain_changed
    f_domain_changed = int(domain_changed)

    # Feature 17: https_downgrade
    f_https_downgrade = int(https_downgrade)

    return [
        f_url_length,
        f_hostname_length,
        f_pathname_length,
        f_query_length,
        f_number_of_dots,
        f_number_of_hyphens,
        f_number_of_digits,
        f_number_of_special_characters,
        f_number_of_subdomains,
        f_has_ip_address,
        f_has_at_symbol,
        f_has_punycode,
        f_has_https,
        f_has_shortener,
        f_redirect_count,
        f_domain_changed,
        f_https_downgrade
    ]
