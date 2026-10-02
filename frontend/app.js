// ==========================================
// Friend Shield - Frontend Controller & PWA
// ==========================================

const API_BASE_URL =
  window.location.origin.includes("localhost:8000") || window.location.origin.includes("127.0.0.1:8000")
    ? "" // Same origin
    : "http://localhost:8000";

const PRESET_MESSAGES = {
  bkash: "বিকাশ থেকে আপনাকে ১০,০০০ টাকা ঈদ বোনাস দেওয়া হয়েছে! এখনই ক্লেইম করুন: http://bkash-eid-bonus.xyz/claim",
  nagad: "অভিনন্দন! আপনি নগদ থেকে ৫,০০০ টাকার ক্যাশ পুরস্কার জিতেছেন। পেতে ভিজিট করুন: http://nagad-cash-bonus.site/claim",
  ip: "Security Alert: Suspicious login detected from new device. Verify your credentials immediately at http://192.168.1.1/admin/login.php",
  safe: "Hello, please review the official documentation on https://github.com and check out https://www.bkash.com/offers"
};

let currentExplanation = null;
let currentLanguage = "bn";
let deferredInstallPrompt = null;

// DOM Elements
const messageInput = document.getElementById("message-input");
const btnClear = document.getElementById("btn-clear");
const scanForm = document.getElementById("scan-form");
const btnSubmit = document.getElementById("btn-submit");
const btnSpinner = document.getElementById("btn-spinner");
const btnInstall = document.getElementById("btn-install");

const apiStatus = document.getElementById("api-status");
const resultsCard = document.getElementById("results-card");
const toastContainer = document.getElementById("toast-container");

const verdictBanner = document.getElementById("verdict-banner");
const verdictIcon = document.getElementById("verdict-icon");
const verdictTitle = document.getElementById("verdict-title");
const threatBadge = document.getElementById("threat-badge");
const verdictDesc = document.getElementById("verdict-desc");

const explanationBox = document.getElementById("explanation-box");
const aiSummary = document.getElementById("ai-summary");
const aiPoints = document.getElementById("ai-points");
const aiActionBox = document.getElementById("ai-action-box");
const actionHeading = document.getElementById("action-heading");
const aiActionText = document.getElementById("ai-action-text");
const langTabs = document.querySelectorAll(".lang-tab");

const urlsList = document.getElementById("urls-list");

// 1. PWA Service Worker Registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((reg) => {
        console.log("[PWA] Service Worker registered with scope:", reg.scope);
      })
      .catch((err) => {
        console.warn("[PWA] Service Worker registration failed:", err);
      });
  });
}

// 2. PWA Install Prompt Handler
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (btnInstall) {
    btnInstall.style.display = "inline-flex";
  }
});

if (btnInstall) {
  btnInstall.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === "accepted") {
      btnInstall.style.display = "none";
    }
    deferredInstallPrompt = null;
  });
}

window.addEventListener("appinstalled", () => {
  if (btnInstall) {
    btnInstall.style.display = "none";
  }
  showToast("Friend Shield অ্যাপটি সফলভাবে ইনস্টল করা হয়েছে! 🎉", "success");
});

// 3. API Health Check
async function checkApiHealth() {
  const statusDot = apiStatus.querySelector(".status-dot");
  const statusText = apiStatus.querySelector(".status-text");

  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      statusDot.className = "status-dot online";
      statusText.textContent = "সার্ভার সক্রিয় (Online)";
    } else {
      throw new Error();
    }
  } catch {
    statusDot.className = "status-dot offline";
    statusText.textContent = "সার্ভার সংযোগ বিচ্ছিন্ন (Offline)";
  }
}

// 4. Preset Click Handlers
document.querySelectorAll(".pill-btn").forEach((btn) => {
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
});

// Keyboard Shortcut: Ctrl + Enter
messageInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    scanForm.requestSubmit();
  }
});

// 5. Language Switcher Tabs
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

  if (currentLanguage === "bn") {
    aiSummary.textContent = currentExplanation.summary_bn || currentExplanation.summary_en || "";
    aiPoints.innerHTML = (currentExplanation.explanation_bn || currentExplanation.explanation_en || "").replace(/\n/g, "<br>");
    actionHeading.textContent = "করণীয় (Action Advice):";
    aiActionText.textContent = currentExplanation.action_advice_bn || currentExplanation.action_advice_en || "";
  } else if (currentLanguage === "en") {
    aiSummary.textContent = currentExplanation.summary_en || currentExplanation.summary_bn || "";
    aiPoints.innerHTML = (currentExplanation.explanation_en || currentExplanation.explanation_bn || "").replace(/\n/g, "<br>");
    actionHeading.textContent = "Recommended Action:";
    aiActionText.textContent = currentExplanation.action_advice_en || currentExplanation.action_advice_bn || "";
  } else if (currentLanguage === "banglish") {
    aiSummary.textContent = currentExplanation.summary_en || currentExplanation.summary_bn || "";
    aiPoints.innerHTML = (currentExplanation.explanation_bn || currentExplanation.explanation_en || "").replace(/\n/g, "<br>");
    actionHeading.textContent = "Ki Korben (Banglish Advice):";
    aiActionText.textContent = currentExplanation.banglish_advice || currentExplanation.action_advice_bn || "";
  }
}

// 6. Form Submission & Scan
scanForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  btnSubmit.disabled = true;
  btnSpinner.hidden = false;
  resultsCard.hidden = true;

  try {
    const payload = {
      message: text,
      resolveRedirects: true,
      checkThreats: true,
      explain: true,
      language: "both"
    };

    const res = await fetch(`${API_BASE_URL}/api/analyze/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "সার্ভার থেকে ত্রুটি ফিরে এসেছে।");
    }

    renderResults(data);
  } catch (err) {
    showToast(err.message || "সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।", "error");
  } finally {
    btnSubmit.disabled = false;
    btnSpinner.hidden = true;
  }
});

// 7. Render Scan Results
function renderResults(data) {
  resultsCard.hidden = false;

  const verdict = data.overallVerdict || (data.threatDetected ? "HIGH_RISK" : "NO_KNOWN_THREAT");

  // Style verdict banner
  verdictBanner.className = "verdict-card";
  if (verdict === "HIGH_RISK") {
    verdictBanner.classList.add("danger");
    verdictIcon.textContent = "🚨";
    verdictTitle.textContent = "উচ্চ ঝুঁকি (HIGH RISK SCAM)";
    threatBadge.textContent = "বিপজ্জনক";
    verdictDesc.textContent = "প্রতারণামূলক বা বিপজ্জনক লিংক শনাক্ত হয়েছে। কোনো লিংকে ক্লিক করবেন না।";
    aiActionBox.className = "action-box danger";
  } else if (verdict === "SUSPICIOUS") {
    verdictBanner.classList.add("warning");
    verdictIcon.textContent = "⚠️";
    verdictTitle.textContent = "সন্দেহজনক (SUSPICIOUS)";
    threatBadge.textContent = "সতর্কতা";
    verdictDesc.textContent = "এই লিংকে অস্বাভাবিক লক্ষণ রয়েছে। সতর্ক থাকুন এবং তথ্য প্রদান এড়িয়ে চলুন।";
    aiActionBox.className = "action-box";
  } else if (verdict === "NEEDS_REVIEW") {
    verdictBanner.classList.add("warning");
    verdictIcon.textContent = "🔍";
    verdictTitle.textContent = "পর্যালোচনা প্রয়োজন (NEEDS REVIEW)";
    threatBadge.textContent = "যাচাই করুন";
    verdictDesc.textContent = "কিছু সতর্কতামূলক লক্ষণ পাওয়া গেছে। বিস্তারিত দেখে নিশ্চিত হোন।";
    aiActionBox.className = "action-box";
  } else {
    verdictBanner.classList.add("safe");
    verdictIcon.textContent = "🛡️";
    verdictTitle.textContent = "নিরাপদ (NO KNOWN THREAT)";
    threatBadge.textContent = "নিরাপদ প্রোফাইল";
    verdictDesc.textContent = "কোনো ক্ষতিকর রেকর্ড বা নিরাপত্তা ঝুঁকি পাওয়া যায়নি।";
    aiActionBox.className = "action-box";
  }

  // Render AI Explanation
  if (data.explanation) {
    explanationBox.hidden = false;
    currentExplanation = data.explanation;
    renderExplanationLanguage();
  } else {
    explanationBox.hidden = true;
  }

  // Render Detected Links (Clean & Simple)
  renderUrlsList(data.urls || []);

  // Smooth scroll into results
  resultsCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

// 8. Render Simple Links List
function renderUrlsList(urls) {
  urlsList.innerHTML = "";

  if (urls.length === 0) {
    urlsList.innerHTML = `<p style="font-size: 0.9rem; color: #64748b; padding: 4px 0;">কোনো ওয়েবসাইট লিংক পাওয়া যায়নি।</p>`;
    return;
  }

  urls.forEach((item) => {
    const row = document.createElement("div");
    row.className = "link-row";

    const v = item.riskAssessment?.verdict || "UNKNOWN";
    let badgeClass = "safe";
    let badgeText = "নিরাপদ ✓";

    if (v === "HIGH_RISK") {
      badgeClass = "danger";
      badgeText = "বিপজ্জনক ✕";
    } else if (v === "SUSPICIOUS" || v === "NEEDS_REVIEW") {
      badgeClass = "warning";
      badgeText = "সন্দেহজনক ⚠️";
    }

    const displayUrl = item.original || item.normalized;
    const finalUrl = item.redirectResolution?.finalUrl;
    const redirectedText = finalUrl && finalUrl !== displayUrl
      ? `<br><small style="color: #64748b;">➜ গন্তব্য: ${escapeHtml(finalUrl)}</small>`
      : "";

    row.innerHTML = `
      <div class="link-url-group">
        <span>🔗</span>
        <div>
          <a href="${escapeHtml(displayUrl)}" target="_blank" rel="noopener noreferrer" class="url-link">
            ${escapeHtml(displayUrl)}
          </a>
          ${redirectedText}
        </div>
      </div>
      <div class="link-badges">
        <span class="badge ${badgeClass}">${badgeText}</span>
      </div>
    `;

    urlsList.appendChild(row);
  });
}

// 9. Toast Notification Handler (Dynamic, auto-dismissing)
function showToast(msg, type = "error") {
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === "error" ? "⚠️" : "✓"}</span> <span>${escapeHtml(msg)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Initialize on page load
checkApiHealth();
