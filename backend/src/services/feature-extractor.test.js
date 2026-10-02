import assert from "node:assert/strict";
import fs from "node:fs";
import { extractUrlFeatures } from "./feature-extractor.service.js";

function runTests() {
  console.log("=== Testing Feature Extractor Service ===");

  // 1. Normal URL
  const normal = extractUrlFeatures("https://www.google.com/search?q=cybersecurity");
  assert.equal(normal.features.length, 17, "Must return exactly 17 features");
  assert.equal(normal.featureMap.has_https, 1);
  assert.equal(normal.featureMap.has_ip_address, 0);
  assert.equal(normal.featureMap.has_shortener, 0);
  assert.equal(normal.featureMap.has_punycode, 0);
  assert.equal(normal.featureMap.redirect_count, 0);
  console.log("✓ Normal URL passed");

  // 2. Shortened URL
  const shortener = extractUrlFeatures("https://bit.ly/3xyzAbc");
  assert.equal(shortener.featureMap.has_shortener, 1);
  assert.ok(
    shortener.signals.some((s) => s.includes("link shortener")),
    "Should flag shortener signal"
  );
  console.log("✓ Shortened URL passed");

  // 3. Raw IP-based URL
  const ipBased = extractUrlFeatures("http://192.168.1.1/admin/login.php");
  assert.equal(ipBased.featureMap.has_ip_address, 1);
  assert.equal(ipBased.featureMap.has_https, 0);
  assert.ok(
    ipBased.signals.some((s) => s.includes("raw IP address")),
    "Should flag IP signal"
  );
  assert.ok(
    ipBased.signals.some((s) => s.includes("login")),
    "Should flag login keyword signal"
  );
  console.log("✓ IP-based URL passed");

  // 4. Punycode URL (IDN Homograph)
  const punycode = extractUrlFeatures("https://xn--e1afmkfd.com/account/verify");
  assert.equal(punycode.featureMap.has_punycode, 1);
  assert.ok(
    punycode.signals.some((s) => s.includes("Punycode")),
    "Should flag Punycode signal"
  );
  console.log("✓ Punycode URL passed");

  // 5. Redirect Chain with Domain Change and HTTPS Downgrade
  const redirectCase = extractUrlFeatures("http://insecure-phish.com/auth", {
    redirectCount: 2,
    originalUrl: "https://bit.ly/safe-looking",
    finalUrl: "http://insecure-phish.com/auth"
  });
  assert.equal(redirectCase.featureMap.redirect_count, 2);
  assert.equal(redirectCase.featureMap.domain_changed, 1);
  assert.equal(redirectCase.featureMap.https_downgrade, 1);
  assert.ok(
    redirectCase.signals.some((s) => s.includes("changed after redirecting")),
    "Should flag domain change signal"
  );
  assert.ok(
    redirectCase.signals.some((s) => s.includes("downgraded from secure HTTPS")),
    "Should flag HTTPS downgrade signal"
  );
  console.log("✓ Redirect chain (domain change & HTTPS downgrade) passed");

  // 6. Excessive Subdomains
  const multiSub = extractUrlFeatures("http://paypal.com.verify-user.account.evil.com/login");
  assert.ok(multiSub.featureMap.number_of_subdomains >= 3);
  assert.ok(multiSub.signals.some((s) => s.includes("unusually high number of subdomains")));
  console.log("✓ Excessive subdomains URL passed");

  // 7. Disguised @ Symbol URL
  const atSymbolUrl = extractUrlFeatures("http://google.com@attacker.org/login");
  assert.equal(atSymbolUrl.featureMap.has_at_symbol, 1);
  assert.ok(atSymbolUrl.signals.some((s) => s.includes("@")));
  console.log("✓ @ Symbol disguised URL passed");

  // 8. Cross-Language Golden Fixture Consistency (Identical to Python)
  const goldenFixture = JSON.parse(
    fs.readFileSync(new URL("../schemas/golden-features.json", import.meta.url), "utf8")
  );
  for (let i = 0; i < goldenFixture.length; i++) {
    const tc = goldenFixture[i];
    const extracted = extractUrlFeatures(tc.url, tc.redirectInfo);
    assert.deepEqual(
      extracted.features,
      tc.expectedFeatures,
      `Cross-language feature mismatch on case ${i + 1}: ${tc.description}`
    );
  }
  console.log(`✓ Cross-language golden fixtures (${goldenFixture.length} cases) match Python 100%`);

  console.log("\nALL 8 FEATURE EXTRACTOR UNIT TESTS PASSED SUCCESSFULLY!");
}

runTests();
