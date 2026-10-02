# Friend Shield - Machine Learning Training Pipeline

This directory is independent from the Node.js backend. It contains the data processing, feature extraction, model training, and ONNX export pipeline for the Friend Shield Phishing Detection model.

---

## Directory Structure

```text
ml-training/
├── data/
│   ├── sample_urls.csv       # Starter dataset for quick testing
│   └── malicious_urls.csv    # (Optional) Drop larger Kaggle datasets here
├── models/
│   └── phishing_model.onnx   # Exported model ready for Node.js ONNX Runtime
├── src/
│   ├── feature_extractor.py  # Extracts 17 numeric features matching feature-schema.json
│   └── train.py              # Loads data, trains Random Forest, evaluates & exports to ONNX
├── feature-schema.json       # Exact schema specification for the 17 features
├── requirements.txt          # Python dependencies
└── README.md
```

---

## How to Run

### 1. Install Dependencies
```bash
cd ml-training
pip install -r requirements.txt
```

### 2. Train and Export Model
```bash
python src/train.py
```

This will:
1. Load the dataset (`data/malicious_urls.csv` if present, otherwise `data/sample_urls.csv`).
2. Extract the 17 numerical features.
3. Train a **Random Forest Classifier**.
4. Print classification metrics (Accuracy, Precision, Recall, F1).
5. Export the model to `models/phishing_model.onnx`.
6. Automatically copy `phishing_model.onnx` into `../backend/models/phishing_model.onnx` so the Express backend can immediately use it.

---

## Using Larger Datasets (Kaggle)
To train on a massive dataset (e.g. 500,000+ URLs):
1. Download a dataset from Kaggle (e.g. [Malicious URLs Dataset](https://www.kaggle.com/datasets/sid321/malicious-urls-dataset)).
2. Rename or save the CSV as `data/malicious_urls.csv`.
3. Run `python src/train.py`.
