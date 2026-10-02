import os
import shutil
import time
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

from feature_extractor import extract_features

TOP_GLOBAL_DOMAINS = [
    "google.com", "youtube.com", "facebook.com", "wikipedia.org",
    "github.com", "microsoft.com", "apple.com", "amazon.com",
    "linkedin.com", "netflix.com", "stackoverflow.com", "reddit.com", "x.com"
]

TOP_BD_LEGITIMATE_DOMAINS = [
    # MFS & Digital Banking
    "bkash.com", "nagad.com.bd", "upaybd.com", "rocket.com.bd", "bb.org.bd",
    "bracbank.com", "dutchbanglabank.com", "citybankonline.com", "ebl.com.bd",
    "islamibankbd.com", "ucb.com.bd", "primebank.com.bd",
    # Government & Public Services (.gov.bd)
    "bangladesh.gov.bd", "nbr.gov.bd", "btrc.gov.bd", "police.gov.bd",
    "educationboardresults.gov.bd", "passport.gov.bd", "nidw.gov.bd",
    "dgshs.gov.bd", "epassport.gov.bd",
    # Telecom Operators
    "grameenphone.com", "banglalink.net", "robi.com.bd", "teletalk.com.bd",
    # E-Commerce & Tech Services
    "daraz.com.bd", "chaldal.com", "rokomari.com", "pickaboo.com",
    "pathao.com", "shohoz.com", "shwapno.com",
    # Universities (.ac.bd / .edu)
    "du.ac.bd", "buet.ac.bd", "ru.ac.bd", "nsu.edu", "bracu.ac.bd", "aiub.edu",
    # News & Media
    "prothomalo.com", "thedailystar.net", "bdnews24.com", "dhakatribune.com",
    "jugantor.com", "kalerkantho.com"
]

TOP_LEGITIMATE_DOMAINS = TOP_GLOBAL_DOMAINS + TOP_BD_LEGITIMATE_DOMAINS

# Empirical Bangladeshi SMS & Phishing scam patterns
TOP_BD_SCAM_PATTERNS = [
    "http://bkash-eid-bonus.xyz/claim",
    "http://bkash-offer2026.site/win",
    "http://bkash-free-sendmoney.com.online-reward.info",
    "http://bkash-verification-alert.top/verify",
    "http://bkash-cashback-bonus.xyz",
    "http://bkash-pin-reset.online/login",
    "http://bkash-lottery-winner.site/claim.php",
    "http://nagad-cash-bonus.site/claim",
    "http://nagad-eid-offer.online/reward",
    "http://nagad-money-win.top/free",
    "http://nagad-verification-otp.xyz/auth",
    "http://nagad-digital-reward.info/prize",
    "http://nagad-5000tk-prize.site",
    "http://upay-bonus-win.xyz/collect",
    "http://rocket-dbbl-prize.site/claim",
    "http://dbbl-nexus-verify.top/login",
    "http://gp-free-internet-50gb.site/claim",
    "http://banglalink-cash-prize.top/win",
    "http://robi-eid-gift.xyz/bonus",
    "http://teletalk-govt-bonus.site/apply",
    "http://daraz-11-11-free-gift.xyz/lucky-draw",
    "http://daraz-voucher-claim.top/discount",
    "http://bd-govt-subsidies.xyz/apply",
    "http://jubo-unnayan-loan.top/registration"
]

def main():
    print("==========================================================")
    print("       Friend Shield ML Model Training Pipeline          ")
    print("==========================================================")

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, "data")

    candidates = [
        os.path.join(data_dir, "malicious_phish.csv"),
        os.path.join(data_dir, "malicious_urls.csv"),
        os.path.join(data_dir, "sample_urls.csv")
    ]

    dataset_path = None
    for c in candidates:
        if os.path.exists(c):
            dataset_path = c
            break

    if not dataset_path:
        raise FileNotFoundError(f"No CSV dataset found in {data_dir}.")

    print(f"Loading dataset from: {dataset_path}")
    t0 = time.time()
    df = pd.read_csv(dataset_path)
    print(f"Loaded {len(df):,} rows in {time.time() - t0:.2f}s")

    url_col = next((c for c in df.columns if c.lower() in ["url", "urls"]), df.columns[0])
    label_col = next((c for c in df.columns if c.lower() in ["type", "label", "result", "target"]), df.columns[1])

    # Clean missing values
    df = df.dropna(subset=[url_col])

    # Separate benign and malicious
    is_benign = df[label_col].astype(str).str.lower().isin(["0", "good", "benign", "safe", "legitimate"])
    df_benign = df[is_benign].copy()
    df_malicious = df[~is_benign].copy()

    print(f"Raw breakdown -> Benign: {len(df_benign):,}, Malicious: {len(df_malicious):,}")

    # 1. Augment benign data with top legitimate domains and realistic common paths
    print("Augmenting benign data with top legitimate domains and realistic paths...")
    COMMON_BENIGN_PATHS = [
        "", "/", "/offers", "/services", "/search", "/about", "/contact", 
        "/help", "/docs", "/news", "/download", "/faq", "/profile"
    ]
    augmented_benign_urls = []
    for d in TOP_LEGITIMATE_DOMAINS:
        clean_d = d.replace("www.", "")
        for p in COMMON_BENIGN_PATHS:
            augmented_benign_urls.append(f"{clean_d}{p}")
            augmented_benign_urls.append(f"www.{clean_d}{p}")

    df_benign_augmented = pd.DataFrame({
        url_col: list(set(augmented_benign_urls)),
        label_col: "benign"
    })

    # 2. Balanced sampling: 50,000 benign and 50,000 malicious
    SAMPLE_PER_CLASS = 50_000
    df_b_sample = pd.concat([
        df_benign.sample(n=min(SAMPLE_PER_CLASS - len(df_benign_augmented), len(df_benign)), random_state=42),
        df_benign_augmented
    ]).drop_duplicates(subset=[url_col]).reset_index(drop=True)

    df_bd_scams = pd.DataFrame({
        url_col: TOP_BD_SCAM_PATTERNS,
        label_col: "phishing"
    })
    df_m_sample = pd.concat([
        df_malicious.sample(n=len(df_b_sample) - len(df_bd_scams), random_state=42),
        df_bd_scams
    ]).drop_duplicates(subset=[url_col]).reset_index(drop=True)

    # 3. Protocol realism: Modern web is predominantly HTTPS.
    # Older Kaggle datasets scraped raw domain strings without protocol schemes.
    # We assign realistic protocol distribution: 85% HTTPS for benign, 50% HTTPS for malicious.
    np.random.seed(42)
    def add_realistic_scheme(url_str, https_probability):
        clean = str(url_str).replace("http://", "").replace("https://", "").strip()
        scheme = "https://" if np.random.rand() < https_probability else "http://"
        return scheme + clean

    df_b_sample[url_col] = df_b_sample[url_col].apply(lambda u: add_realistic_scheme(u, 0.85))
    df_m_sample[url_col] = df_m_sample[url_col].apply(lambda u: add_realistic_scheme(u, 0.50))

    df_balanced = pd.concat([df_b_sample, df_m_sample]).sample(frac=1.0, random_state=42).reset_index(drop=True)
    df_balanced["target"] = (df_balanced[label_col] != "benign").astype(int)

    print(f"Balanced training set: {len(df_balanced):,} total URLs ({len(df_b_sample):,} Benign, {len(df_m_sample):,} Malicious)")

    # 4. Extract 17 numeric features
    print("\nExtracting 17 numeric features...")
    t_feat = time.time()
    features_list = [extract_features(str(u)) for u in df_balanced[url_col]]
    print(f"Extracted {len(features_list):,} feature vectors in {time.time() - t_feat:.2f}s")

    X = np.array(features_list, dtype=np.float32)
    y = df_balanced["target"].values.astype(np.int64)

    # Train / Test split (80% train, 20% test)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"\nTraining Random Forest model on {len(X_train):,} URLs (Testing on {len(X_test):,} URLs)...")
    t_train = time.time()
    clf = RandomForestClassifier(
        n_estimators=80,
        max_depth=14,
        min_samples_split=5,
        random_state=42,
        n_jobs=-1
    )
    clf.fit(X_train, y_train)
    print(f"Model training completed in {time.time() - t_train:.2f}s")

    # Evaluation
    print("\n=================== MODEL EVALUATION ===================")
    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred)

    print(f"Overall Test Accuracy: {acc * 100:.2f}%\n")
    print("Classification Report:")
    print(classification_report(y_test, y_pred, target_names=["Safe (0)", "Malicious (1)"], digits=4))

    print("Confusion Matrix:")
    print(f"  True Negatives (Safe correctly predicted):       {cm[0][0]:,}")
    print(f"  False Positives (Safe wrongly flagged):         {cm[0][1]:,}")
    print(f"  False Negatives (Malicious missed):             {cm[1][0]:,}")
    print(f"  True Positives (Malicious correctly caught):    {cm[1][1]:,}")

    # Export to ONNX
    print("\n================== ONNX MODEL EXPORT ===================")
    print("Converting model to ONNX format...")
    initial_type = [("float_input", FloatTensorType([None, 17]))]
    onnx_model = convert_sklearn(
        clf,
        initial_types=initial_type,
        options={id(clf): {"zipmap": False}}
    )

    models_dir = os.path.join(base_dir, "models")
    os.makedirs(models_dir, exist_ok=True)
    onnx_path = os.path.join(models_dir, "phishing_model.onnx")

    with open(onnx_path, "wb") as f:
        f.write(onnx_model.SerializeToString())

    file_size_mb = os.path.getsize(onnx_path) / (1024 * 1024)
    print(f"Saved ONNX model: {onnx_path} ({file_size_mb:.2f} MB)")

    # Copy directly into backend/models for runtime inference
    backend_models_dir = os.path.join(os.path.dirname(base_dir), "backend", "models")
    os.makedirs(backend_models_dir, exist_ok=True)
    backend_onnx_path = os.path.join(backend_models_dir, "phishing_model.onnx")
    shutil.copyfile(onnx_path, backend_onnx_path)
    print(f"Copied model into backend: {backend_onnx_path}")
    print("\nTraining & Export successfully finished!")

if __name__ == "__main__":
    main()
