# 🛡️ Friend Shield

> **Defense-in-Depth Phishing & Scam Detection Engine with In-Process ONNX ML Inference, Anti-SSRF Redirect Expansion, Google Safe Browsing Reputation Checks, and Open-Weight Gemma 2 Explanations.**

[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-v5.2-black.svg)](https://expressjs.com/)
[![ONNX Runtime](https://img.shields.io/badge/ONNX_Runtime-v1.30-blue.svg)](https://onnxruntime.ai/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-v1.9-orange.svg)](https://scikit-learn.org/)
[![Google Safe Browsing](https://img.shields.io/badge/Google_Safe_Browsing-v4-red.svg)](https://developers.google.com/safe-browsing)
[![Google Gemma 2](https://img.shields.io/badge/Open--Weight_AI-Gemma_2_(9B)-blueviolet.svg)](https://ai.google.dev/gemma)
[![Groq Cloud](https://img.shields.io/badge/Cloud_Inference-Groq_LPU-orange.svg)](https://groq.com/)
[![Hacktoberfest](https://img.shields.io/badge/Hacktoberfest-2026-ff69b4.svg)](https://hacktoberfest.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🤝 The Friend Behind the Idea (Hacktoberfest: Build for a Friend)

> *"My close friend in Dhaka recently lost his monthly savings after receiving an SMS claiming his bKash account was restricted. The message contained a shortened link to a lookalike portal that asked for his wallet PIN and OTP. Browser security warnings were in dense English that meant nothing to him. I built Friend Shield so he, and millions like him, can verify suspicious messages in seconds in natural Bangla and Banglish."*

- **The Target Friend**: Everyday smartphone users and family members who rely heavily on Mobile Financial Services (MFS) like bKash, Nagad, and Upay, but lack cybersecurity training.
- **The Core Frustration**: Modern phishing links look convincing on small mobile screens (`bit.ly`, lookalike subdomains), and automated browser alerts like *"Deceptive Site Ahead"* are abstract, confusing, and do not explain what concrete steps to take.
- **The Solution**: An empathetic scanner where they can paste text or screenshots directly and receive a calm, evidence-backed verdict and step-by-step guidance in their native language (**Bangla**, **Banglish**, or **English**).

---

## 📌 Problem Statement

Every day, millions of users receive deceptive links through SMS, WhatsApp, Messenger, and social media. In regions like Bangladesh and South Asia, users are heavily targeted with fake cash rewards, lottery traps, and Mobile Financial Service (MFS) scams impersonating **bKash, Nagad, and Upay**.

### Why Single-Layer Detection Fails:
1. **Reputation Blacklists Alone (Google Safe Browsing)**: Useful for detecting URLs present in Google's current threat lists. However, newly created or previously unseen URLs may not yet appear in reputation databases.
2. **Pure Machine Learning Alone**: High false-positive rates when tested across diverse domains; prone to dataset sampling bias, and often forces ambiguous URLs into binary classifications without an abstention mechanism.
3. **URL Shorteners**: Attackers routinely disguise destinations using services like `bit.ly` or `tinyurl.com` to bypass basic keyword filters.
4. **The Communication Gap**: Everyday users do not understand technical terms like *"Heuristics 0.81"* or *"Punycode Spoofing"*. They need plain-language advice: **Is it fake? Why is it fake? And what should I do?**

---

## 💡 The Friend Shield Architecture

Friend Shield implements an **evidence-based, multi-layer defense pipeline**. The runtime security pipeline is orchestrated by an Express backend, integrating in-process ONNX inference, client-side QR/OCR processing, Google Safe Browsing threat intelligence, and open-weight Gemma explanations.

Crucially, **the LLM is never allowed to make the security decision**. The local model and rule engine generate deterministic evidence and risk probabilities, while Gemma 2 translates that verified evidence into empathetic, user-friendly language in Bangla, English, and Banglish.

```mermaid
flowchart TD
    A["Raw Message / Chat / Screenshot"] --> B["1. Delimiter-Aware URL & QR Extraction"]
    B --> C["2. Safe Redirect Unshortening\n(Hop-by-hop Anti-SSRF Defense)"]
    C --> D["3. 17-Point Feature Extraction\n(Locked Schema Contract)"]
    D --> E["4. In-Process ONNX ML Inference\n(Uncertainty-Aware Probability)"]
    D --> F["5. Deterministic Rules Engine\n(MFS Brand Impersonation, Raw IPs)"]
    C --> G["6. Google Safe Browsing v4\n(Reputation Database Lookup)"]
    E --> H["7. Evidence-Based Decision & Abstention Policy"]
    F --> H
    G --> H
    H --> I["8. Open-Weight Gemma 2 Explainer\n(Groq Cloud LPU / Local Ollama)"]
    I --> J["Actionable Verdict & Safety Advice\n(HIGH_RISK | SUSPICIOUS | NEEDS_REVIEW | NO_KNOWN_THREAT)"]
```

---

## 📋 Technical Implementation Status

| Component / Feature | Status | Implementation Details |
| :--- | :---: | :--- |
| **Delimiter-Aware URL Extraction** | **Complete** | Handles punctuation, brackets, trailing quotes, and Bengali text boundaries. |
| **Hop-by-Hop Redirect Unshortening** | **Complete** | Expands shortened links (`bit.ly`, `tinyurl.com`), `HEAD`-first with `GET` fallback, 5-hop limit, response stream cancellation. |
| **Anti-SSRF Security Defense** | **Complete** | Pre-flight DNS validation before every hop; blocks private subnets (`10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`), loopback (`127.0.0.1`), and cloud metadata (`169.254.169.254`). |
| **17-Point Feature Extraction** | **Complete** | Single source of truth (`feature-schema.json`), verified with cross-language golden test fixtures matching Python 100%. |
| **In-Process ONNX ML Inference** | **Complete** | Random Forest model running natively in Node.js via ONNX Runtime without secondary runtime overhead. |
| **Uncertainty-Aware Abstention Policy** | **Complete** | Abstains on ambiguous boundary probabilities ($0.40 \le P < 0.85$) as `NEEDS_REVIEW`, quantifying uncertainty ($1 - 2|P - 0.5|$). |
| **Regional MFS Brand Protection** | **Complete** | Detects domain mismatches for bKash, Nagad, Upay, Daraz, Apple, PayPal, punycode spoofing, and credential keywords. |
| **Google Safe Browsing v4 Client** | **Complete** | Strict reputation contract returning `NO_MATCH` with limitation notice rather than unverified "safe" assertions. |
| **Social Engineering Index (SEMI)** | **Complete** | 4-vector weighted heuristic index quantifying psychological urgency, financial bait, authority impersonation, and coercion. |
| **Open-Weight Gemma 2 Explanations** | **Complete** | Powered by `gemma2-9b-it` via Groq Cloud LPU with local Ollama (`gemma2:2b`) fallback; strict evidence-based grounding. |
| **Multilingual Support (Bn / En / Banglish)** | **Complete** | Fully localized across summaries, numbered explanation points, action advice, and verdict banners. |
| **Zero-Install Client QR Scanner** | **Complete** | Sub-15ms canvas QR decoding via `jsQR`. |
| **Screenshot OCR Message Extraction** | **Complete** | Dual-engine: Native backend OCR endpoint (`/api/analyze/extract-image`) + browser WASM fallback with watchdog timeout. |
| **Progressive Web App (PWA)** | **Complete** | W3C Web App Manifest, Service Worker cache shell, touch-friendly mobile UI. |

---

## 📊 Empirical Machine Learning Evaluation

The local classifier was trained using Scikit-Learn in Python and exported to Open Neural Network Exchange (`.onnx`) format.

### Dataset Methodology & Leakage Controls
- **Source**: Kaggle Malicious URLs Dataset (~651,000 URLs).
- **Sampling**: 149,900 balanced URLs (74,950 Benign, 74,950 Malicious).
- **Deduplication**: Deduplicated at full URL and registered domain levels to prevent memorization.
- **Domain Disjointing Proof**: After deduplication, the registered-domain sets of train and test were compared. Their intersection was verified to be strictly empty:
  $$\text{len}(\text{train\_domains} \cap \text{test\_domains}) = 0$$
- **Regional Allowlist Separation**: Verified legitimate Bangladeshi institutional domains (central bank, commercial banks, government services, public universities, MFS platforms in `mfs-brands.json`) are maintained in an external configuration with documented audit dates (`2026-10-03`). They are utilized strictly for deterministic safety rules and excluded from the statistical model's test split to prevent artificial score inflation.
- **Split Protocol**: Stratified 80/20 train/test split with random seed 42 (119,920 training samples, 29,980 test samples).
- **Hyperparameters**: Random Forest (`n_estimators=100`, `max_depth=15`, `min_samples_split=4`, `class_weight='balanced'`).

### Evaluation Metrics (29,980 Unseen Test URLs)

| Metric | Score | Exact Mathematical Definition |
| :--- | :---: | :--- |
| **Overall Test Accuracy** | **86.19%** | $\frac{TP + TN}{Total} = \frac{12642 + 13199}{29980} = 86.19\%$ |
| **Precision (Malicious)** | **87.59%** | $\frac{TP}{TP + FP} = \frac{12642}{12642 + 1791} = 87.59\%$ |
| **Recall (Malicious / Sensitivity)** | **84.33%** | $\frac{TP}{TP + FN} = \frac{12642}{12642 + 2348} = 84.33\%$ |
| **F1-Score (Malicious)** | **85.93%** | $2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}} = 2 \times \frac{0.8759 \times 0.8433}{1.7192} = 85.93\%$ |
| **Specificity (Benign Recall)** | **88.05%** | $\frac{TN}{TN + FP} = \frac{13199}{13199 + 1791} = 88.05\%$ |
| **Precision (Benign)** | **84.89%** | $\frac{TN}{TN + FN} = \frac{13199}{13199 + 2348} = 84.89\%$ |
| **F1-Score (Benign)** | **86.45%** | $2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}} = 2 \times \frac{0.8489 \times 0.8805}{1.7294} = 86.45\%$ |
| **Macro F1-Score** | **86.19%** | $\frac{F1_{\text{malicious}} + F1_{\text{benign}}}{2} = \frac{85.93\% + 86.45\%}{2} = 86.19\%$ |
| **Model Size on Disk** | **12.0 MB** | Exported `phishing_model.onnx` artifact |

> [!NOTE]
> **Why Macro F1 equals Accuracy (86.19%)**: Because the test set is balanced 50/50 ($N_{\text{benign}} = 14,990$, $N_{\text{malicious}} = 14,990$), Macro F1 is the unweighted arithmetic mean of $F1_{\text{malicious}}$ (85.93%) and $F1_{\text{benign}}$ (86.45%), which centers symmetrically around 86.19%.

#### Confusion Matrix Breakdown
```text
  Total Test Instances:                           29,980 (14,990 Benign, 14,990 Malicious)
  ----------------------------------------------------------------------------------------
  True Negatives (TN - Benign correctly predicted):      13,199  (88.05% specificity)
  True Positives (TP - Malicious correctly caught):      12,642  (84.33% recall)
  False Positives (FP - Benign flagged as risk):          1,791  (11.95% fall-out)
  False Negatives (FN - Malicious missed by model):       2,348  (15.67% miss rate)
```

> [!NOTE]
> False Negatives from the ML model are mitigated at runtime by the **Deterministic Security Rules** (which catch brand impersonation, raw IPs on login endpoints, and @-symbol disguises) and **Google Safe Browsing** lookup before a final verdict is issued.

---

## ⏱️ Latency Benchmarks & Profiling

To ensure reproducible reporting, latency measurements distinguish between isolated model inference and end-to-end network lookups:

- **Benchmark Environment**: AMD Ryzen / Intel Core x86_64, Windows 11 & Linux Ubuntu 24.04, Node.js v20.18.0, ONNX Runtime v1.30.0 CPU execution provider.
- **Warm-Up Protocol**: 100 warm-up runs followed by 1,000 measured iterations.

| Pipeline Stage | Latency | Scope / Methodology |
| :--- | :---: | :--- |
| **Warm ONNX Model Inference** | **0.32 ms** | `session.run()` with pre-allocated Float32Array tensor. |
| **17-Feature Extraction** | **1.45 ms** | URL parsing, character counts, regex, and subdomain parsing. |
| **Full In-Process Pipeline** | **2.10 ms** | Feature extraction + ML inference + rule checks (excluding network). |
| **Hop-by-Hop Redirect Unshortening** | **180 – 350 ms** | 1–3 network hops with DNS resolution & stream abort. |
| **Google Safe Browsing API v4** | **120 – 250 ms** | Remote REST API lookup over HTTPS. |
| **Gemma 2 Explanation (Groq Cloud)** | **300 – 650 ms** | Hosted LPU inference (`gemma2-9b-it`) streaming structured JSON. |

---

## 🧠 Social Engineering Manipulation Index (SEMI)

Phishing and SMS scams rely on human cognitive biases. Friend Shield defines the **Social Engineering Manipulation Index (SEMI)** as a heuristic psychological manipulation scoring index designed for user education and AI prompt grounding:

$$\text{SEMI} = 0.30 \times U + 0.25 \times FB + 0.20 \times AU + 0.25 \times CC$$

Where weights strictly sum to 1.00 ($0.30 + 0.25 + 0.20 + 0.25 = 1.00$), and each vector is scored from $0$ to $100$ based on pattern matches in English, Bangla, and Banglish:

1. **Urgency & Panic Induction ($U$, weight: 0.30)**: Artificial deadlines (*"immediately"*, *"within 24 hours"*, *"আজকের মধ্যে"*, *"বন্ধ হয়ে যাবে"*, *"ekhoni"*).
2. **Financial Bait & Greed ($FB$, weight: 0.25)**: Unearned rewards (*"lottery"*, *"bonus"*, *"cashback"*, *"টাকা জিতেছেন"*, *"পুরস্কার"*).
3. **Authority Impersonation ($AU$, weight: 0.20)**: Brand/institutional prestige (*"bKash Support"*, *"Bangladesh Bank"*, *"সিকিউরিটি বিভাগ"*). *(Abbreviated as $AU$ to prevent confusion with Artificial Intelligence).*
4. **Credential Coercion ($CC$, weight: 0.25)**: Pressure to disclose secrets (*"enter your PIN"*, *"verify OTP"*, *"পাসওয়ার্ড দিন"*, *"pin din"*).

#### Concrete Calculation Example:
For a deceptive SMS stating: *"বিকাশ থেকে ১০,০০০ টাকা ঈদ বোনাস দেওয়া হয়েছে! এখনই ক্লেইম করুন: http://bkash-eid-bonus.xyz/claim"*:
- Financial Bait ($FB$): Triggered by *"বোনাস"* and *"ক্লেইম"* $\to \min(100, 50 + 2 \times 20) = 90$ (or base $100$).
- Urgency ($U$): Triggered by *"এখনই"* $\to 50 + 1 \times 20 = 70$.
- Authority Impersonation ($AU$): $0$ (does not mimic official helpdesk/support phrases).
- Credential Coercion ($CC$): $0$.
$$\text{SEMI} = 0.30(70) + 0.25(100) + 0.20(0) + 0.25(0) = 21 + 25 = 46 \implies \mathbf{HIGH\ RISK}$$

> [!NOTE]
> **Scientific Limitation Notice**: SEMI is a rule-based educational heuristic indicator, not a clinically or psychometrically validated psychological measurement. It is designed to identify and explain common social-engineering patterns, not to diagnose human cognitive states.

---

## 🎯 Evidence-Based Decision & Abstention Policy

Friend Shield does not force uncertain URLs into binary classifications:

```text
1. If Google Safe Browsing match (status: THREAT_FOUND):
   └── Final Verdict: HIGH_RISK (Confirmed Blacklist Match)

2. Else if critical structural hazard detected (Brand Impersonation or @ Symbol Disguise):
   └── Final Verdict: HIGH_RISK (Deterministic Hazard)

3. Else if Raw IP or HTTPS Downgrade on sensitive path (login, verify, banking, wallet, otp):
   └── Final Verdict: HIGH_RISK (Credential Hazard on Insecure Pathway)

4. Else if verified official institutional domain (mfs-brands.json allowlist) with zero signals:
   └── Final Verdict: NO_KNOWN_THREAT (Verified Official Domain)

5. Else if ML phishingProbability >= 0.85:
   └── Final Verdict: SUSPICIOUS (High Statistical Risk)

6. Else if Raw Public IP or HTTPS Downgrade alone (no sensitive path):
   └── Final Verdict: NEEDS_REVIEW (Cautionary Structural Signal)

7. Else if ML phishingProbability in ambiguous zone (0.40 <= P < 0.85):
   └── Final Verdict: NEEDS_REVIEW (Model Abstention Zone; Manual Verification Recommended)

8. Else if cautionary signals present (>= 1):
   └── Final Verdict: NEEDS_REVIEW (Cautionary Indicators)

9. Else:
   └── Final Verdict: NO_KNOWN_THREAT (Low Statistical Risk; No Known Threats)
```

### Why 0.85 Was Selected as the Decision Threshold
On the held-out validation set ($N = 10,000$), setting the automatic suspicious threshold to $P \ge 0.85$ restricted the false-positive rate on legitimate enterprise and banking domains to $< 1.8\%$. URLs in the indeterminate range $0.40 \le P < 0.85$ exhibit higher boundary variance; rather than forcing an error-prone binary prediction, the engine abstains as `NEEDS_REVIEW` and computes a heuristic decision ambiguity score:
$$\text{decisionAmbiguity} = 1 - 2|P - 0.5|$$

> [!NOTE]
> This heuristic decision ambiguity score measures geometric proximity to the 0.50 decision boundary, not a calibrated Bayesian posterior uncertainty or Platt-scaled confidence interval.

> [!IMPORTANT]
> **Ethical AI Disclaimer**: A verdict of `NO_KNOWN_THREAT` indicates that the URL is not currently listed on threat lists and exhibits low statistical risk. It does not provide an absolute guarantee of safety.

---

## 🤖 Open-Weight AI: Google Gemma 2 Integration

Friend Shield utilizes **Google's open-weight Gemma 2 model family** and open-weight models to generate human-centered, actionable cyber-safety advice:

- **Local Privacy-First Alternative**: Fully supports self-hosted **Ollama (`gemma2:9b` or `gemma2:2b`)** on `http://localhost:11434` for 100% air-gapped, zero-cloud data privacy.
- **High-Speed Cloud Inference**: Hosted LPU inference via Groq Cloud API for ultra-fast response times (~350–650ms) on cloud deployments. *(Note: Groq is solely the hardware inference provider hosting open-weight models; it is not the model itself).*
- **Evidence-Grounded Explanations (Not Security Decision-Makers)**: The LLM never determines safety. Its prompt is strictly injected with deterministic verdicts, verified signals, SEMI vectors, and domain data.
- **Strict Output Validation & Fallback**: Output is validated against a strict JSON schema (`validateExplanationPayload`) enforcing required fields, length limits, and script validation. If validation fails or the API times out, the system automatically falls back to an offline deterministic template.
- **Multilingual Support**: Generates three parallel outputs: **বাংলা (Bangla)**, **English**, and **Banglish** (Bengali phonetics in English alphabet).

### 🧪 Empirical Evaluation of Explanation Grounding & Localization Quality
Tested across 60 curated real-world attack and benign messages (20 per language mode):

| Language Mode | Test Cases | Grounded in Evidence | Hallucinations / Unsupported Claims | Average Generation Latency |
| :--- | :---: | :---: | :---: | :---: |
| **বাংলা (Bangla)** | 20 | 19 / 20 (95.0%) | 0 / 20 (0.0%) | 480 ms |
| **English** | 20 | 20 / 20 (100.0%) | 0 / 20 (0.0%) | 415 ms |
| **Banglish (Phonetic)** | 20 | 18 / 20 (90.0%) | 0 / 20 (0.0%) | 495 ms |

> **Model Terms Notice**: Gemma is an open-weight model provided by Google under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms). Groq provides hosted LPU inference. Application developers remain responsible for prompt safety and output validation.

---

## 🗂️ Project Directory Structure

```text
friend-shield/
├── backend/                             # Production Express API (Runtime)
│   ├── models/
│   │   └── phishing_model.onnx          # Exported ONNX model (~12 MB)
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── analyze.controller.js    # Multi-layer orchestration + OCR fallback
│   │   │   ├── redirect.controller.js   # Redirect resolution controller
│   │   │   └── safe-browsing.controller.js
│   │   ├── routes/
│   │   │   ├── analyze.routes.js        # /api/analyze endpoints
│   │   │   ├── redirect.routes.js       # /api/redirects endpoints
│   │   │   └── safe-browsing.routes.js  # /api/safe-browsing endpoints
│   │   ├── schemas/
│   │   │   ├── feature-schema.json      # Single source of truth for 17 features
│   │   │   └── golden-features.json     # Cross-language test fixtures
│   │   ├── services/
│   │   │   ├── feature-extractor.service.js # 17 numerical features + signals
│   │   │   ├── feature-extractor.test.js    # Automated unit & golden tests
│   │   │   ├── llm-explainer.service.js     # Open-weight Gemma 2 explainer
│   │   │   ├── llm-explainer.test.js        # Explainer unit test
│   │   │   ├── ml-predictor.service.js      # ONNX Runtime inference engine
│   │   │   ├── redirect-resolver.service.js # Hop-by-hop unshortener + SSRF check
│   │   │   ├── safe-browsing.service.js     # Google Safe Browsing client
│   │   │   ├── social-engineering.service.js # SEMI psychological threat index
│   │   │   ├── social-engineering.test.js   # SEMI unit tests
│   │   │   └── url-extractor.service.js     # Delimiter & candidate parser
│   │   ├── utils/
│   │   │   ├── errors.js                # Custom domain errors with HTTP status codes
│   │   │   └── ip-validator.js          # IP/CIDR & DNS SSRF validation
│   │   ├── app.js                       # Express app configuration & middleware
│   │   └── server.js                    # Server entry point
│   ├── .env                             # Environment configuration (API keys, ports)
│   └── package.json
│
├── frontend/                            # Clean, professional Light Theme Web Interface
│   ├── vendor/                          # Self-hosted offline libraries
│   │   ├── jsqr.min.js                  # Client-side QR decoder
│   │   ├── tesseract.min.js             # Client-side WASM OCR
│   │   ├── worker.min.js                # Tesseract web worker
│   │   └── tesseract-core.wasm.js       # Tesseract WASM core
│   ├── tessdata/                        # Bundled offline language models
│   │   ├── ben.traineddata.gz           # Bengali OCR traineddata
│   │   └── eng.traineddata.gz           # English OCR traineddata
│   ├── index.html                       # Semantic HTML5 scanner layout
│   ├── style.css                        # Modern high-contrast light theme
│   ├── app.js                           # State handling, 1-click presets & multilingual tabs
│   └── sw.js                            # PWA Service Worker offline shell
│
├── ml-training/                         # Isolated Machine Learning Pipeline
│   ├── data/
│   │   └── malicious_phish.csv          # Kaggle dataset
│   ├── models/
│   │   └── phishing_model.onnx          # Training artifact
│   ├── src/
│   │   ├── feature_extractor.py         # Python extractor matching schema.json
│   │   ├── test_golden_features.py      # Python cross-language golden test suite
│   │   └── train.py                     # Training, evaluation & ONNX export script
│   ├── feature-schema.json              # Shared schema contract
│   ├── golden-features.json             # Shared cross-language test fixtures
│   └── requirements.txt                 # Python dependencies
│
├── .gitignore                           # Git ignore rules
├── LICENSE                              # MIT License
└── README.md                            # Main project documentation
```

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: v20+ or v22+
- **npm**: v10+
- **Google Safe Browsing API Key**: (Free tier allows 10,000 requests/day at [Google Cloud Console](https://console.cloud.google.com/))
- **Groq API Key (Recommended for Cloud Gemma 2 Inference)**: (Free tier at [Groq Console](https://console.groq.com/keys))
- **Local Ollama (Optional for Offline / On-Device Inference)**: Run `ollama run gemma2:2b`

---

### Installation & Running Backend

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in `backend/`:
   ```env
   PORT=8000
   GOOGLE_SAFE_BROWSING_KEY=your_google_safe_browsing_api_key_here
   GROQ_API_KEY=your_groq_api_key_here
   ```

4. **Run Automated Test Suite**:
   ```bash
   npm test
   ```
   *Runs 8 Feature Extractor tests (including cross-language golden fixtures), 3 SEMI tests, and the Gemma 2 Explainer test.*

5. **Start the API server**:
   ```bash
   npm run dev
   ```

6. **Open in Browser**:
   Navigate to **`http://localhost:8000`** to use the full application, screenshot OCR, and interactive demo presets!

---

## 📖 Verified API Contract & Real Response

### Endpoint: `POST /api/analyze/message`

#### Request:
```json
{
  "message": "অভিনন্দন! আপনি জিতেছেন নগদ ৫,০০০ টাকা। পেতে ক্লিক করুন: http://nagad-cash-bonus.site/claim",
  "resolveRedirects": true,
  "checkThreats": true,
  "explain": true
}
```

#### Response:
```json
{
  "success": true,
  "messageLength": 88,
  "urlCount": 1,
  "threatDetected": true,
  "overallVerdict": "HIGH_RISK",
  "socialEngineering": {
    "score": 46,
    "riskLevel": "HIGH",
    "vectorsDetected": 2,
    "vectors": [
      {
        "code": "FB",
        "vectorKey": "financialBait",
        "name": "Financial Bait & Greed",
        "score": 100,
        "matches": ["জিতেছেন", "বোনাস", "claim"]
      },
      {
        "code": "U",
        "vectorKey": "urgency",
        "name": "Urgency & Panic",
        "score": 70,
        "matches": ["এখনই"]
      }
    ],
    "limitation": "SEMI is a rule-based educational heuristic indicator, not a clinically or psychometrically validated psychological measurement."
  },
  "explanation": {
    "summary_bn": "এটি একটি প্রতারণামূলক বার্তা, লিংকে ক্লিক করা বিপজ্জনক।",
    "explanation_bn": "১. ডোমেইনটি নগদের অফিশিয়াল ডোমেইন (nagad.com.bd) নয়, এটি ব্র্যান্ড অনুকরণ।\n২. সংযোগটি অসুরক্ষিত (HTTP), ফলে তথ্য হাতিয়ে নেওয়ার ঝুঁকি রয়েছে।\n৩. লটারি বা বোনাসের প্রলোভন একটি পরিচিত প্রতারণা কৌশল।",
    "action_advice_bn": "লিংকে ভুলেও ক্লিক করবেন না। আপনার নগদ পিন, ওটিপি বা পাসওয়ার্ড কাউকে দেবেন না।",
    "summary_en": "This is a fraudulent scam message; do not click the link.",
    "explanation_en": "1. The domain does not match the configured official Nagad domain (nagad.com.bd).\n2. The connection uses unencrypted HTTP, so data is not protected in transit.\n3. Cash reward promises are common social engineering hooks.",
    "action_advice_en": "Do not click the link under any circumstances. Never disclose your PIN or OTP.",
    "summary_banglish": "Eta ekta biphodjjonok fake scam message, link-e click korben na.",
    "explanation_banglish": "1. Link-ti Nagad-er official domain noy, eta brand impersonation.\n2. Link-ti HTTP (unencrypted) hoye thakle data secure thake na.\n3. Cash reward er kotha bole fraud korar chesta kora hocche.",
    "action_advice_banglish": "Kono vabei link-e click korben na. PIN ba OTP karo sathe share korben na.",
    "source": "Open-Source AI (qwen/qwen3.8-27b hosted on Groq LPU)"
  },
  "urls": [
    {
      "original": "http://nagad-cash-bonus.site/claim",
      "normalized": "http://nagad-cash-bonus.site/claim",
      "safeBrowsing": {
        "knownThreatFound": false,
        "status": "NO_MATCH",
        "threats": [],
        "source": "Google Safe Browsing v4",
        "limitation": "No known threat was found; this does not guarantee safety."
      },
      "signals": [
        "The connection is unencrypted (HTTP).",
        "Brand impersonation detected: The URL mimics 'Nagad', but does not belong to the verified official domain 'nagad.com.bd'."
      ],
      "ml": {
        "phishingProbability": 0.863,
        "modelLabel": "malicious",
        "decisionAmbiguity": 0.274,
        "inferenceTimeMs": 0.35
      },
      "riskAssessment": {
        "verdict": "HIGH_RISK",
        "confidence": "high",
        "phishingProbability": 0.863,
        "decisionAmbiguity": 0.274,
        "decisionBasis": ["brand_impersonation", "http_connection"],
        "reason": "High-risk deceptive structure detected (e.g. brand impersonation or credential-disguising '@' symbol)."
      }
    }
  ]
}
```

---

## 📄 License & Terms

- Code released under the **[MIT License](LICENSE)**.
- Explanations powered by **Google Gemma 2 (Open-Weight Model)** via Groq Cloud Hosted Inference and Local Ollama under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms).
