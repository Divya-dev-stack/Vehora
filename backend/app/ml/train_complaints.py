import json
import re
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "datasets" / "complaints.csv"
MODEL = Path(__file__).resolve().parent / "models" / "complaint_model.joblib"
METRICS = ROOT / "docs" / "complaint_metrics.json"


def normalize(text):
    text = str(text).lower()
    text = re.sub(r"[^a-z0-9\u0b80-\u0bff\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def build_pipeline():
    features = FeatureUnion([
        ("word", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True)),
    ])
    return Pipeline([
        ("features", features),
        ("clf", LogisticRegression(C=10, max_iter=2000, class_weight="balanced")),
    ])


def main():
    df = pd.read_csv(DATA).dropna()
    df["text"] = df["text"].map(normalize)
    df = df[df["text"].str.len() > 0].drop_duplicates(subset="text")
    X, y = df["text"], df["label"]

    print("Samples after cleaning:", len(df))
    print(y.value_counts().to_string())

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    holdout = build_pipeline().fit(X_tr, y_tr)
    pred = holdout.predict(X_te)
    h_acc = accuracy_score(y_te, pred)
    h_f1 = f1_score(y_te, pred, average="macro")

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_pred = cross_val_predict(build_pipeline(), X, y, cv=cv)
    cv_acc = accuracy_score(y, cv_pred)
    cv_f1 = f1_score(y, cv_pred, average="macro")

    print("\n=== Hold-out test (20%) ===")
    print(classification_report(y_te, pred, zero_division=0))
    print(f"Hold-out accuracy: {h_acc:.3f} | macro F1: {h_f1:.3f}")
    print(f"5-fold CV accuracy: {cv_acc:.3f} | macro F1: {cv_f1:.3f}")

    final = build_pipeline().fit(X, y)
    joblib.dump(final, MODEL)

    METRICS.parent.mkdir(parents=True, exist_ok=True)
    METRICS.write_text(json.dumps({
        "dataset_size": int(len(df)),
        "classes": sorted(y.unique().tolist()),
        "holdout_accuracy": round(h_acc, 3),
        "holdout_macro_f1": round(h_f1, 3),
        "cv_accuracy": round(cv_acc, 3),
        "cv_macro_f1": round(cv_f1, 3),
        "note": "Small self-created dataset. Scores are likely optimistic on real user text.",
    }, indent=2), encoding="utf-8")
    print("\nModel saved:", MODEL)


if __name__ == "__main__":
    main()
