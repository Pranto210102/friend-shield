// ==========================================
// Friend Shield - Frontend Controller & PWA
// ==========================================

const API_BASE_URL =
  window.location.protocol === "file:" ||
  (window.location.hostname === "localhost" && window.location.port && window.location.port !== "8000")
    ? "http://localhost:8000"
    : ""; // Same-origin relative path for port 8000 and any production cloud deployment (Render, etc.)

const PRESET_MESSAGES = {
  bkash: "বিকাশ থেকে আপনাকে ১০,০০০ টাকা ঈদ বোনাস দেওয়া হয়েছে! এখনই ক্লেইম করুন: http://bkash-eid-bonus.xyz/claim",
  nagad: "অভিনন্দন! আপনি নগদ থেকে ৫,০০০ টাকার ক্যাশ পুরস্কার জিতেছেন। পেতে ভিজিট করুন: http://nagad-cash-bonus.site/claim",
  ip: "Security Alert: Suspicious login detected from new device. Verify your credentials immediately at http://192.168.1.1/admin/login.php",
  safe: "Hello, please review the official documentation on https://github.com and check out https://www.bkash.com/offers"
};

let currentExplanation = null;
let currentLanguage = "bn";
let currentScanVerdict = null;
let deferredInstallPrompt = null;

// DOM Elements
const messageInput = document.getElementById("message-input");
const btnClear = document.getElementById("btn-clear");
const scanForm = document.getElementById("scan-form");
const btnSubmit = document.getElementById("btn-submit");
const btnSpinner = document.getElementById("btn-spinner");
const btnInstall = document.getElementById("btn-install");

const imageUploadInput = document.getElementById("image-upload-input");
const btnMediaUpload = document.getElementById("btn-media-upload");
const imagePreviewCard = document.getElementById("image-preview-card");
const previewImage = document.getElementById("preview-image");
const previewFilename = document.getElementById("preview-filename");
const previewStatus = document.getElementById("preview-status");
const btnPreviewRemove = document.getElementById("btn-preview-remove");
const mediaScanStatus = document.getElementById("media-scan-status");
const mediaScanStatusText = document.getElementById("media-scan-status-text");

const apiStatus = document.getElementById("api-status");
const resultsCard = document.getElementById("results-card");
const toastContainer = document.getElementById("toast-container");

const verdictBanner = document.getElementById("verdict-banner");
const verdictIcon = document.getElementById("verdict-icon");
const verdictTitle = document.getElementById("verdict-title");
const threatBadge = document.getElementById("threat-badge");
const verdictDesc = document.getElementById("verdict-desc");

const semiCard = document.getElementById("semi-card");
const semiBadge = document.getElementById("semi-badge");
const semiMeterBar = document.getElementById("semi-meter-bar");
const semiVectors = document.getElementById("semi-vectors");

const explanationBox = document.getElementById("explanation-box");
const aiSource = document.getElementById("ai-source");
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

// Multilingual dictionaries and transliteration helpers
const VERDICT_I18N = {
  HIGH_RISK: {
    bn: {
      title: "উচ্চ ঝুঁকি (HIGH RISK SCAM)",
      badge: "বিপজ্জনক",
      desc: "প্রতারণামূলক বা বিপজ্জনক লিংক শনাক্ত হয়েছে। কোনো লিংকে ক্লিক করবেন না।"
    },
    en: {
      title: "High Risk Scam (DANGEROUS)",
      badge: "High Risk",
      desc: "Fraudulent or dangerous link detected. Do not click on any links."
    },
    banglish: {
      title: "Uccho Jhnuki (HIGH RISK SCAM)",
      badge: "Bipodjjonok",
      desc: "Scam ba fake link pawa geche. Kono link-e click korben na."
    }
  },
  SUSPICIOUS: {
    bn: {
      title: "সন্দেহজনক (SUSPICIOUS)",
      badge: "সতর্কতা",
      desc: "এই লিংকে অস্বাভাবিক লক্ষণ রয়েছে। সতর্ক থাকুন এবং তথ্য প্রদান এড়িয়ে চলুন।"
    },
    en: {
      title: "Suspicious Activity (CAUTION)",
      badge: "Suspicious",
      desc: "Unusual patterns detected in this link. Exercise caution and do not submit personal info."
    },
    banglish: {
      title: "Shondehojonok (SUSPICIOUS)",
      badge: "Shotorkota",
      desc: "Ei link-e oshawavabik lokkhon ache. Shotorko thakun ebong information deben na."
    }
  },
  NEEDS_REVIEW: {
    bn: {
      title: "পর্যালোচনা প্রয়োজন (NEEDS REVIEW)",
      badge: "যাচাই করুন",
      desc: "কিছু সতর্কতামূলক লক্ষণ পাওয়া গেছে। বিস্তারিত দেখে নিশ্চিত হোন।"
    },
    en: {
      title: "Needs Review (VERIFY)",
      badge: "Review",
      desc: "Potential cautionary indicators found. Verify carefully before proceeding."
    },
    banglish: {
      title: "Jachai Kora Proyojon (NEEDS REVIEW)",
      badge: "Check Korun",
      desc: "Kichu shotorko shongket pawa geche. Bistarito dekhe confirm hon."
    }
  },
  NO_KNOWN_THREAT: {
    bn: {
      title: "নিরাপদ (NO KNOWN THREAT)",
      badge: "নিরাপদ প্রোফাইল",
      desc: "কোনো ক্ষতিকর রেকর্ড বা নিরাপত্তা ঝুঁকি পাওয়া যায়নি।"
    },
    en: {
      title: "Safe (NO KNOWN THREAT)",
      badge: "Safe Profile",
      desc: "No malicious patterns or security risks detected."
    },
    banglish: {
      title: "Nirapod (NO KNOWN THREAT)",
      badge: "Safe Profile",
      desc: "Kono bipod ba security risk pawa jayni."
    }
  }
};

function hasBengaliChars(text) {
  return /[\u0980-\u09FF]/.test(text || "");
}

function toBanglish(text) {
  if (!text || typeof text !== "string") return "";

  let str = text
    .replace(/বিকাশ/g, "bKash")
    .replace(/নগদ/g, "Nagad")
    .replace(/বোনাস/g, "bonus")
    .replace(/টাকা/g, "taka")
    .replace(/লিংক/g, "link")
    .replace(/লিংকে/g, "link-e")
    .replace(/ক্লিক/g, "click")
    .replace(/করবেন না/g, "korben na")
    .replace(/করুন/g, "korun")
    .replace(/পিন/g, "PIN")
    .replace(/পাসওয়ার্ড/g, "password")
    .replace(/ওটিপি/g, "OTP")
    .replace(/অ্যাকাউন্ট|একাউন্ট/g, "account")
    .replace(/নিরাপদ/g, "nirapod")
    .replace(/বিপজ্জনক/g, "bipodjjonok")
    .replace(/সন্দেহজনক/g, "shondehojonok")
    .replace(/উচ্চ সতর্কতা/g, "High Alert")
    .replace(/বার্তাটিতে/g, "message-e")
    .replace(/বার্তা|মেসেজ/g, "message")
    .replace(/ব্যক্তিগত তথ্য/g, "personal info")
    .replace(/শেয়ার করবেন না/g, "share korben na");

  const map = {
    'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri',
    'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
    'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
    'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
    'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't', 'ং': 'ng', 'ঃ': 'h', 'ঁ': '',
    'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri',
    'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou', '্': '',
    '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5',
    '৬': '6', '৭': '7', '৮': '8', '৯': '9', '০': '0', '।': '.'
  };

  return str.replace(/[\u0980-\u09FF]/g, (ch) => map[ch] || "");
}

function renderVerdictBanner(verdict, lang = currentLanguage) {
  const i18n = VERDICT_I18N[verdict]?.[lang] || VERDICT_I18N[verdict]?.["bn"] || {
    title: verdict,
    badge: verdict,
    desc: ""
  };

  verdictTitle.textContent = i18n.title;
  threatBadge.textContent = i18n.badge;
  verdictDesc.textContent = i18n.desc;
}

// 5. Language Switcher Tabs
langTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    langTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentLanguage = tab.dataset.lang;
    renderExplanationLanguage();
    if (currentScanVerdict) {
      renderVerdictBanner(currentScanVerdict, currentLanguage);
    }
  });
});

function renderExplanationLanguage() {
  if (!currentExplanation) return;

  if (currentLanguage === "bn") {
    aiSummary.textContent = currentExplanation.summary_bn || currentExplanation.summary_en || "";
    aiPoints.innerHTML = escapeHtml(currentExplanation.explanation_bn || currentExplanation.explanation_en || "").replace(/\n/g, "<br>");
    actionHeading.textContent = "করণীয় (Action Advice):";
    aiActionText.textContent = currentExplanation.action_advice_bn || currentExplanation.action_advice_en || "";
  } else if (currentLanguage === "en") {
    aiSummary.textContent = currentExplanation.summary_en || currentExplanation.summary_bn || "";
    aiPoints.innerHTML = escapeHtml(currentExplanation.explanation_en || currentExplanation.explanation_bn || "").replace(/\n/g, "<br>");
    actionHeading.textContent = "Recommended Action:";
    aiActionText.textContent = currentExplanation.action_advice_en || currentExplanation.action_advice_bn || "";
  } else if (currentLanguage === "banglish") {
    let s = currentExplanation.summary_banglish || currentExplanation.banglish_advice || "";
    if (!s || hasBengaliChars(s)) {
      s = toBanglish(currentExplanation.summary_bn || currentExplanation.summary_en || "");
    }
    aiSummary.textContent = s;

    let p = currentExplanation.explanation_banglish || "";
    if (!p || hasBengaliChars(p)) {
      p = toBanglish(currentExplanation.explanation_bn || currentExplanation.explanation_en || "");
    }
    aiPoints.innerHTML = escapeHtml(p).replace(/\n/g, "<br>");

    actionHeading.textContent = "Ki Korben (Banglish Action Advice):";
    let a = currentExplanation.action_advice_banglish || currentExplanation.banglish_advice || "";
    if (!a || hasBengaliChars(a)) {
      a = toBanglish(currentExplanation.action_advice_bn || currentExplanation.action_advice_en || "");
    }
    aiActionText.textContent = a;
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
  currentScanVerdict = verdict;

  // Style verdict banner container classes
  verdictBanner.className = "verdict-card";
  if (verdict === "HIGH_RISK") {
    verdictBanner.classList.add("danger");
    verdictIcon.textContent = "🚨";
    aiActionBox.className = "action-box danger";
  } else if (verdict === "SUSPICIOUS") {
    verdictBanner.classList.add("warning");
    verdictIcon.textContent = "⚠️";
    aiActionBox.className = "action-box";
  } else if (verdict === "NEEDS_REVIEW") {
    verdictBanner.classList.add("warning");
    verdictIcon.textContent = "🔍";
    aiActionBox.className = "action-box";
  } else {
    verdictBanner.classList.add("safe");
    verdictIcon.textContent = "🛡️";
    aiActionBox.className = "action-box";
  }

  // Render localized text for verdict banner
  renderVerdictBanner(currentScanVerdict, currentLanguage);

  // Render Social Engineering Manipulation Index (SEMI)
  renderSemiCard(data.socialEngineering);

  // Render AI Explanation
  if (data.explanation) {
    explanationBox.hidden = false;
    currentExplanation = data.explanation;
    if (aiSource) {
      aiSource.textContent = data.explanation.source ? `মডেল: ${data.explanation.source}` : "";
    }
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

// 10. Render Social Engineering Manipulation Index (SEMI)
function renderSemiCard(semi) {
  if (!semiCard) return;

  if (!semi || semi.score === undefined) {
    semiCard.hidden = true;
    return;
  }

  semiCard.hidden = false;

  const score = semi.score || 0;
  const level = (semi.riskLevel || "MINIMAL").toLowerCase();

  // Meter bar width
  if (semiMeterBar) {
    semiMeterBar.style.width = `${Math.max(5, score)}%`;
  }

  // Badge text and class
  if (semiBadge) {
    semiBadge.className = `semi-badge ${level}`;
    let levelText = `ঝুঁকিমুক্ত (${score}%)`;
    if (level === "critical") levelText = `উচ্চ ঝুঁকি (${score}%) - Critical Manipulation`;
    else if (level === "high") levelText = `সতর্কতা (${score}%) - High Manipulation`;
    else if (level === "moderate") levelText = `মাঝারি (${score}%) - Moderate`;

    semiBadge.textContent = levelText;
  }

  // Vector pills
  if (semiVectors) {
    semiVectors.innerHTML = "";
    const vectors = semi.vectors || [];

    if (vectors.length === 0) {
      semiVectors.innerHTML = `<span style="font-size: 0.8rem; color: #64748b;">কোনো স্পষ্ট মনস্তাত্ত্বিক চাপ বা প্রলোভন শনাক্ত হয়নি। (No manipulation triggers detected)</span>`;
    } else {
      vectors.forEach((v) => {
        const pill = document.createElement("span");
        pill.className = `semi-vector-pill ${v.vectorKey}`;
        let icon = "⚠️";
        if (v.vectorKey === "urgency") icon = "⏳";
        if (v.vectorKey === "financialBait") icon = "🎁";
        if (v.vectorKey === "authorityImpersonation") icon = "🏛️";
        if (v.vectorKey === "credentialCoercion") icon = "🔑";

        const matchesStr = v.matches && v.matches.length > 0 ? ` [${v.matches.slice(0, 2).join(", ")}]` : "";
        pill.innerHTML = `<span>${icon}</span> <span>${escapeHtml(v.name_bn || v.name)}${escapeHtml(matchesStr)}</span>`;
        semiVectors.appendChild(pill);
      });
    }
  }
}

// 11. Image, Screenshot & QR Code Scanner (jsQR + Tesseract.js OCR)
let currentPreviewObjectUrl = null;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function showMediaScanning(text) {
  if (mediaScanStatus && mediaScanStatusText) {
    mediaScanStatusText.textContent = text;
    mediaScanStatus.hidden = false;
  }
}

function hideMediaScanning() {
  if (mediaScanStatus) {
    mediaScanStatus.hidden = true;
  }
}

function showImagePreview(file) {
  if (!imagePreviewCard || !previewImage) return;

  if (currentPreviewObjectUrl) {
    URL.revokeObjectURL(currentPreviewObjectUrl);
    currentPreviewObjectUrl = null;
  }

  currentPreviewObjectUrl = URL.createObjectURL(file);
  previewImage.src = currentPreviewObjectUrl;

  const sizeKb = Math.round(file.size / 1024);
  const name = file.name && file.name !== "image.png" ? file.name : `স্ক্রিনশট (${sizeKb} KB)`;
  if (previewFilename) previewFilename.textContent = name;
  if (previewStatus) previewStatus.textContent = "স্ক্যান করা হচ্ছে...";

  imagePreviewCard.hidden = false;
}

function hideImagePreview() {
  if (imagePreviewCard) {
    imagePreviewCard.hidden = true;
  }
  if (currentPreviewObjectUrl) {
    URL.revokeObjectURL(currentPreviewObjectUrl);
    currentPreviewObjectUrl = null;
  }
  if (imageUploadInput) {
    imageUploadInput.value = "";
  }
}

if (btnPreviewRemove) {
  btnPreviewRemove.addEventListener("click", () => {
    hideImagePreview();
    hideMediaScanning();
  });
}

/**
 * Preprocess image onto a canvas for OCR & QR decoding.
 * Rescales large dimensions to max 1600px for fast recognition.
 */
function prepareCanvas(img) {
  let width = img.width;
  let height = img.height;
  const maxDim = 1600;

  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  } else if (width < 320 && height < 320) {
    width *= 2;
    height *= 2;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, ctx };
}

/**
 * Robust Client-Side OCR extraction with local wasm/worker, eng+ben fallback, and timeout protection
 */
async function runOcrOnCanvas(canvas) {
  if (typeof Tesseract === "undefined") {
    throw new Error("Tesseract OCR engine is not loaded.");
  }
  const options = {};

  function updateProgress(m) {
    if (m.status === "recognizing text" && typeof m.progress === "number") {
      const pct = Math.round(m.progress * 100);
      showMediaScanning(`স্ক্রিনশটের লেখা পড়া হচ্ছে: ${pct}%`);
      if (previewStatus) previewStatus.textContent = `OCR বিশ্লেষণ: ${pct}%`;
    } else if (m.status) {
      showMediaScanning(`${m.status}...`);
    }
  }

  const ocrPromise = (async () => {
    try {
      const res = await Tesseract.recognize(canvas, "eng+ben", {
        ...options,
        logger: updateProgress
      });
      const text = res?.data?.text?.trim();
      if (text && text.length >= 4) return text;
    } catch (err) {
      console.warn("Client eng+ben failed, trying eng:", err);
    }

    const resEng = await Tesseract.recognize(canvas, "eng", {
      ...options,
      logger: updateProgress
    });
    return resEng?.data?.text?.trim() || "";
  })();

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Client OCR timed out")), 5000)
  );

  return Promise.race([ocrPromise, timeoutPromise]);
}

/**
 * Main handler when an image file or pasted screenshot blob is received.
 * Dual-Engine: First checks client QR code, then tries fast native server OCR,
 * falling back to client-side WASM OCR if offline.
 */
async function processImageFile(file) {
  if (!file || (!file.type.startsWith("image/") && !file.type.includes("octet-stream"))) {
    showToast("অনুগ্রহ করে একটি ছবি ফাইল সিলেক্ট বা পেস্ট করুন।", "error");
    return;
  }

  showImagePreview(file);
  showMediaScanning("ছবি প্রস্তুত করা হচ্ছে...");

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);
    const { canvas, ctx } = prepareCanvas(img);

    // 1. First, quickly check for QR Code (fastest ~15ms)
    showMediaScanning("কিউআর কোড (QR Code) খোঁজা হচ্ছে...");
    let qrData = null;

    if (typeof jsQR !== "undefined") {
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert"
        });
        if (code && code.data) {
          qrData = code.data.trim();
        }
      } catch (qrErr) {
        console.warn("jsQR check skipped:", qrErr);
      }
    }

    if (qrData) {
      hideMediaScanning();
      if (previewStatus) previewStatus.textContent = "✅ কিউআর কোড শনাক্ত হয়েছে";
      showToast("কিউআর কোড থেকে লিংক পাওয়া গেছে!", "success");
      messageInput.value = qrData;
      scanForm.requestSubmit();
      return;
    }

    // 2. If no QR Code, run OCR via Fast Native Server Endpoint
    showMediaScanning("স্ক্রিনশটের মেসেজ ও লিংক পড়া হচ্ছে...");
    if (previewStatus) previewStatus.textContent = "টেক্সট বিশ্লেষণ হচ্ছে...";

    let extractedText = "";

    try {
      const res = await fetch(`${API_BASE_URL}/api/analyze/extract-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.text) {
          extractedText = json.text;
        }
      }
    } catch (serverOcrErr) {
      console.warn("Server OCR unavailable, trying client-side fallback:", serverOcrErr);
    }

    // 3. Fallback to Client-Side WASM OCR if server was unavailable or returned empty
    if (!extractedText && typeof Tesseract !== "undefined") {
      if (previewStatus) previewStatus.textContent = "ব্রাউজার OCR-এ চেষ্টা করা হচ্ছে...";
      try {
        extractedText = await runOcrOnCanvas(canvas);
      } catch (clientOcrErr) {
        console.warn("Client OCR also failed or timed out:", clientOcrErr);
      }
    }

    hideMediaScanning();

    if (extractedText && extractedText.length >= 3) {
      // Clean up multiple blank lines
      const cleaned = extractedText
        .split("\n")
        .map((line) => line.trim())
        .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1].length > 0))
        .join("\n");

      if (previewStatus) {
        const words = cleaned.split(/\s+/).filter(Boolean).length;
        previewStatus.textContent = `✅ টেক্সট পাওয়া গেছে (${words} শব্দ)`;
      }

      showToast("স্ক্রিনশট থেকে মেসেজ টেক্সট উদ্ধার করা হয়েছে!", "success");
      messageInput.value = cleaned;
      scanForm.requestSubmit();
    } else {
      if (previewStatus) previewStatus.textContent = "⚠️ কোনো টেক্সট পাওয়া যায়নি";
      showToast("ছবিটিতে কোনো স্পষ্ট মেসেজ টেক্সট বা কিউআর কোড পাওয়া যায়নি।", "warning");
    }
  } catch (err) {
    hideMediaScanning();
    console.error("Image processing error:", err);
    if (previewStatus) previewStatus.textContent = "❌ বিশ্লেষণ ব্যর্থ হয়েছে";
    showToast("ছবি বিশ্লেষণ করতে সমস্যা হয়েছে। অনুগ্রহ করে মেসেজটি সরাসরি পেস্ট করুন।", "error");
  }
}

// File Upload Handler (file chooser input)
if (imageUploadInput) {
  imageUploadInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  });
}

// Clipboard Paste Handler (Ctrl+V anywhere on window or inside messageInput)
function handleClipboardPaste(e) {
  const clipboardData = e.clipboardData;
  if (!clipboardData) return;

  // 1. Check for files (e.g. copied image file or screenshot)
  const files = clipboardData.files;
  if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      if (files[i].type && files[i].type.startsWith("image/")) {
        e.preventDefault();
        e.stopPropagation();
        processImageFile(files[i]);
        return;
      }
    }
  }

  // 2. Check clipboard items (e.g. Win+Shift+S snipped image or copy image)
  const items = clipboardData.items;
  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          e.stopPropagation();
          processImageFile(file);
          return;
        }
      }
    }
  }
}

// Attach paste listeners on both textarea and window
if (messageInput) {
  messageInput.addEventListener("paste", handleClipboardPaste);
}
window.addEventListener("paste", handleClipboardPaste);

// Drag & Drop Handler on Message Input Wrap
const inputWrap = document.querySelector(".input-wrap");
if (inputWrap) {
  ["dragenter", "dragover"].forEach((eventName) => {
    inputWrap.addEventListener(eventName, (e) => {
      e.preventDefault();
      inputWrap.style.borderColor = "var(--primary)";
      inputWrap.style.backgroundColor = "var(--primary-light)";
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    inputWrap.addEventListener(eventName, (e) => {
      e.preventDefault();
      inputWrap.style.borderColor = "";
      inputWrap.style.backgroundColor = "";
    });
  });

  inputWrap.addEventListener("drop", (e) => {
    const files = e.dataTransfer?.files;
    if (files && files[0] && files[0].type.startsWith("image/")) {
      processImageFile(files[0]);
    }
  });
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
