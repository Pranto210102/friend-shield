// ==========================================
// Friend Shield - Frontend Application Logic
// ==========================================

const API_BASE_URL =
  window.location.origin.includes("localhost:8000") || window.location.origin.includes("127.0.0.1:8000")
    ? "" // Same origin
    : "http://localhost:8000"; // Cross-origin default

const PRESET_MESSAGES = {
  bkash: "বিকাশ থেকে আপনাকে ১০,০০০ টাকা ঈদ বোনাস দেওয়া হয়েছে! এখনই ক্লেইম করুন: http://bkash-eid-bonus.xyz/claim",
  nagad: "অভিনন্দন! আপনি নগদ থেকে ৫,০০০ টাকার ক্যাশ পুরস্কার জিতেছেন। পেতে ভিজিট করুন: http://nagad-cash-bonus.site/claim",
  ip: "Security Alert: Suspicious login detected from new device. Verify your credentials immediately at http://192.168.1.1/admin/login.php",
  safe: "Hello, please review the official documentation on https://github.com and check out https://www.bkash.com/offers"
};

let currentExplanation = null;
let currentLanguage = "bn";

// DOM Elements
const messageInput = document.getElementById("message-input");
const btnClear = document.getElementById("btn-clear");
const scanForm = document.getElementById("scan-form");
const btnSubmit = document.getElementById("btn-submit");
const btnSpinner = document.getElementById("btn-spinner");
const toggleRedirects = document.getElementById("toggle-redirects");
const toggleThreats = document.getElementById("toggle-threats");
const toggleGemini = document.getElementById("toggle-gemini");

const apiStatus = document.getElementById("api-status");
const resultsCard = document.getElementById("results-card");
const errorBanner = document.getElementById("error-banner");
const errorText = document.getElementById("error-text");

const verdictBanner = document.getElementById("verdict-banner");
const verdictIcon = document.getElementById("verdict-icon");
const verdictTitle = document.getElementById("verdict-title");
const threatBadge = document.getElementById("threat-badge");
const verdictDesc = document.getElementById("verdict-desc");

const explanationBox = document.getElementById("explanation-box");
const aiSourceTag = document.getElementById("ai-source-tag");
const aiSummary = document.getElementById("ai-summary");
const aiPoints = document.getElementById("ai-points");
const aiActionBox = document.getElementById("ai-action-box");
const actionHeading = document.getElementById("action-heading");
const aiActionText = document.getElementById("ai-action-text");
const langTabs = document.querySelectorAll(".lang-tab");

const urlsCountBadge = document.getElementById("urls-count-badge");
const urlsList = document.getElementById("urls-list");

// 1. API Health Check Ping
async function checkApiHealth() {
  const statusDot = apiStatus.querySelector(".status-dot");
  const statusText = apiStatus.querySelector(".status-text");

  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      statusDot.className = "status-dot online";
      statusText.textContent = "API Online (Port 8000)";
    } else {
      throw new Error();
    }
  } catch {
    statusDot.className = "status-dot offline";
    statusText.textContent = "API Offline (Start Backend)";
  }
}

// 2. Preset Click Handlers
document.querySelectorAll(".btn-preset").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.preset;
    if (PRESET_MESSAGES[key]) {
      messageInput.value = PRESET_MESSAGES[key];
      messageInput.focus();
    }
  });
});

// Clear button
btnClear.addEventListener("click", () => {
  messageInput.value = "";
  messageInput.focus();
  resultsCard.hidden = true;
  errorBanner.hidden = true;
});

// Keyboard Shortcut: Ctrl + Enter
messageInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    scanForm.requestSubmit();
  }
});

// 3. Language Switcher Tabs
langTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    langTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentLanguage = tab.dataset.lang;
    renderExplanationLanguage();
  });
});

function renderExplanationLanguage() {
  if (!currentExplanation) return;

  const isDanger = verdictBanner.classList.contains("danger") || verdictBanner.classList.contains("warning");

  if (currentLanguage === "bn") {
    aiSummary.textContent = currentExplanation.summary_bn || currentExplanation.summary_en || "";
    aiPoints.innerHTML = (currentExplanation.explanation_bn || currentExplanation.explanation_en || "").replace(/\n/g, "<br>");
    actionHeading.textContent = "করণীয় (Action Advice):";
    aiActionText.textContent = currentExplanation.action_advice_bn || currentExplanation.action_advice_en || "";
  } else if (currentLanguage === "en") {
    aiSummary.textContent = currentExplanation.summary_en || currentExplanation.summary_bn || "";
    aiPoints.innerHTML = (currentExplanation.explanation_en || currentExplanation.explanation_bn || "").replace(/\n/g, "<br>");
    actionHeading.textContent = "Recommended Action:";
    aiActionText.textContent = currentExplanation.action_advice_en || currentExplanation.action_advice_bn || "";
  } else if (currentLanguage === "banglish") {
    aiSummary.textContent = currentExplanation.summary_en || currentExplanation.summary_bn || "";
    aiPoints.innerHTML = (currentExplanation.explanation_bn || "").replace(/\n/g, "<br>");
    actionHeading.textContent = "Ki Korben (Banglish Advice):";
    aiActionText.textContent = currentExplanation.banglish_advice || currentExplanation.action_advice_bn || "";
  }

  aiActionBox.className = isDanger ? "action-card danger" : "action-card";
}

// 4. Form Submission & Scan
scanForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  // Set loading state
  btnSubmit.disabled = true;
  btnSpinner.hidden = false;
  resultsCard.hidden = true;
  errorBanner.hidden = true;

  try {
    const payload = {
      message: text,
      resolveRedirects: toggleRedirects.checked,
      checkThreats: toggleThreats.checked,
      explain: toggleGemini.checked,
      language: "both"
    };

    const res = await fetch(`${API_BASE_URL}/api/analyze/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Server returned an error");
    }

    renderResults(data);
  } catch (err) {
    showError(err.message || "Failed to connect to Friend Shield API.");
  } finally {
    btnSubmit.disabled = false;
    btnSpinner.hidden = true;
  }
});

// 5. Render Scan Results
function renderResults(data) {
  resultsCard.hidden = false;
  errorBanner.hidden = true;

  const verdict = data.overallVerdict || (data.threatDetected ? "HIGH_RISK" : "NO_KNOWN_THREAT");

  // Style verdict banner
  verdictBanner.className = "verdict-banner";
  if (verdict === "HIGH_RISK") {
    verdictBanner.classList.add("danger");
    verdictIcon.textContent = "🚨";
    verdictTitle.textContent = "উচ্চ ঝুঁকি (HIGH RISK)";
    threatBadge.textContent = "Danger Detected";
    verdictDesc.textContent = "বিপজ্জনক বা প্রতারণামূলক সংকেত শনাক্ত হয়েছে। কোনো লিংকে ক্লিক করবেন না।";
  } else if (verdict === "SUSPICIOUS") {
    verdictBanner.classList.add("warning");
    verdictIcon.textContent = "⚠️";
    verdictTitle.textContent = "সন্দেহজনক (SUSPICIOUS)";
    threatBadge.textContent = "Suspicious Link";
    verdictDesc.textContent = "এই লিংকটির আচরণ বা গঠনে সন্দেহজনক লক্ষণ পাওয়া গেছে। সতর্ক থাকুন।";
  } else if (verdict === "NEEDS_REVIEW") {
    verdictBanner.classList.add("warning");
    verdictIcon.textContent = "🔍";
    verdictTitle.textContent = "পর্যালোচনা প্রয়োজন (NEEDS REVIEW)";
    threatBadge.textContent = "Review Needed";
    verdictDesc.textContent = "বেশ কিছু অস্বাভাবিক লক্ষণ পাওয়া গেছে। বিস্তারিত দেখে সিদ্ধান্ত নিন।";
  } else {
    verdictBanner.classList.add("success");
    verdictIcon.textContent = "🛡️";
    verdictTitle.textContent = "পরিচিত কোনো ঝুঁকি নেই (NO KNOWN THREAT)";
    threatBadge.textContent = "Safe Profile";
    verdictDesc.textContent = "সেফ ব্রাউজিং বা লোকাল এমএল মডেলে কোনো ক্ষতিকর রেকর্ড মেলেনি।";
  }

  // Render AI Explanation
  if (data.explanation) {
    explanationBox.hidden = false;
    currentExplanation = data.explanation;
    aiSourceTag.textContent = currentExplanation.source || "Gemini AI";
    renderExplanationLanguage();
  } else {
    explanationBox.hidden = true;
  }

  // Render Detected URLs Breakdown
  const urls = data.urls || [];
  urlsCountBadge.textContent = `${urls.length} URL${urls.length === 1 ? "" : "s"}`;
  urlsList.innerHTML = "";

  if (urls.length === 0) {
    urlsList.innerHTML = `<p class="text-muted">বার্তায় কোনো সরাসরি ওয়েব লিংক পাওয়া যায়নি।</p>`;
    return;
  }

  urls.forEach((item) => {
    const card = document.createElement("div");
    card.className = "url-card";

    const hasRedirect = item.redirectResolution?.resolved && item.redirectResolution?.finalUrl !== item.normalized;
    const isSafeBrowsingThreat = item.safeBrowsing?.knownThreatFound;
    const mlProb = item.ml?.probability !== undefined ? (item.ml.probability * 100).toFixed(1) : null;
    const mlLatency = item.ml?.inferenceTimeMs !== undefined ? `${item.ml.inferenceTimeMs}ms` : null;

    card.innerHTML = `
      <div class="url-card-top">
        <div class="url-link-wrapper">
          <span>🔗</span>
          <a href="${escapeHtml(item.normalized)}" target="_blank" rel="noopener noreferrer" class="url-link">
            ${escapeHtml(item.normalized)}
          </a>
        </div>
      </div>

      ${hasRedirect ? `
        <div class="redirect-badge">
          ↳ <strong>Redirects to:</strong> ${escapeHtml(item.redirectResolution.finalUrl)}
          (${item.redirectResolution.redirectCount} hop${item.redirectResolution.redirectCount > 1 ? "s" : ""})
        </div>
      ` : ""}

      <div class="evidence-badges">
        <span class="badge ${isSafeBrowsingThreat ? "danger" : "safe"}">
          Safe Browsing: ${isSafeBrowsingThreat ? "🚨 Known Threat Match" : "✓ Clean"}
        </span>

        ${mlProb !== null ? `
          <span class="badge ${Number(mlProb) >= 50 ? "danger" : "safe"}">
            Local ML Risk: ${mlProb}% ${mlLatency ? `(${mlLatency})` : ""}
          </span>
        ` : ""}

        <span class="badge neutral">
          Protocol: ${escapeHtml(item.protocol || "http")}
        </span>
      </div>

      ${item.signals && item.signals.length > 0 ? `
        <ul class="signals-list">
          ${item.signals.map(s => `<li>${escapeHtml(s)}</li>`).join("")}
        </ul>
      ` : ""}
    `;

    urlsList.appendChild(card);
  });
}

function showError(msg) {
  errorBanner.hidden = false;
  errorText.textContent = msg;
  resultsCard.hidden = true;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Check health on boot
checkApiHealth();
setInterval(checkApiHealth, 15000);
