"""Offline training: chronological validation/test and disjoint-road future stress test."""

import argparse
import hashlib
import json
import platform
from datetime import datetime, timezone
from pathlib import Path
import joblib
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from generate_dataset import DATA_VERSION, SEED, generate
from scenarios import CATEGORICAL, CLASSES, FEATURES, NUMERIC, REGIONS, ROAD_TARGETS

PARAMETERS = dict(
    n_estimators=120,
    max_depth=14,
    min_samples_leaf=5,
    random_state=SEED,
    n_jobs=2,
    class_weight="balanced",
)


def splits(frame):
    heldout = [ROAD_TARGETS[i * 3 + i % 3]["id"] for i in range(len(REGIONS))]
    dates = sorted(frame.timestamp.str[:10].unique())
    if len(dates) < 5:
        raise ValueError("Need at least five distinct days")
    train_end, valid_end = dates[int(len(dates) * 0.6)], dates[int(len(dates) * 0.8)]
    day = frame.timestamp.str[:10]
    known = ~frame.road_id.isin(heldout)
    return {
        "train": frame[known & (day < train_end)],
        "validation": frame[known & (day >= train_end) & (day < valid_end)],
        "test": frame[known & (day >= valid_end)],
        "unseen_road_test": frame[~known & (day >= valid_end)],
    }, heldout


def metrics(model, data):
    actual = data.congestion
    predicted = model.predict(data[FEATURES])
    return dict(
        rows=len(data),
        accuracy=accuracy_score(actual, predicted),
        macro_f1=f1_score(
            actual, predicted, labels=CLASSES, average="macro", zero_division=0
        ),
        confusion_matrix=confusion_matrix(actual, predicted, labels=CLASSES).tolist(),
        class_order=CLASSES,
        per_class=classification_report(
            actual, predicted, labels=CLASSES, output_dict=True, zero_division=0
        ),
    )


def train(output_dir=Path("artifacts"), report_path=Path("reports/evaluation.json")):
    output_dir, report_path = Path(output_dir), Path(report_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    frame = generate()
    raw = frame.to_csv(index=False, lineterminator="\n").encode()
    checksum = hashlib.sha256(raw).hexdigest()
    data_dir = output_dir / "data"
    data_dir.mkdir(exist_ok=True)
    (data_dir / "traffic.csv").write_bytes(raw)
    partitions, heldout = splits(frame)
    forest = Pipeline(
        [
            (
                "features",
                ColumnTransformer(
                    [
                        (
                            "categorical",
                            OneHotEncoder(handle_unknown="ignore"),
                            CATEGORICAL,
                        ),
                        ("numeric", "passthrough", NUMERIC),
                    ]
                ),
            ),
            ("classifier", RandomForestClassifier(**PARAMETERS)),
        ]
    )
    models = {
        "majority_baseline": DummyClassifier(strategy="most_frequent"),
        "random_forest": forest,
    }
    evaluations = {}
    for name, model in models.items():
        model.fit(partitions["train"][FEATURES], partitions["train"].congestion)
        evaluations[name] = {
            split: metrics(model, partitions[split])
            for split in ["validation", "test", "unseen_road_test"]
        }
    # Selection never uses either test set; no refit on validation/test.
    selected = max(models, key=lambda key: evaluations[key]["validation"]["macro_f1"])
    identity = dict(
        data_sha256=checksum,
        features=FEATURES,
        parameters=PARAMETERS,
        sklearn=sklearn.__version__,
        selection=selected,
        pipeline_version="m3-v1",
    )
    version = (
        "synthetic-v1-"
        + hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()[:16]
    )
    model_file = output_dir / "model.joblib"
    joblib.dump(models[selected], model_file)
    metadata = dict(
        modelVersion=version,
        modelType=selected,
        trainedAt=datetime.now(timezone.utc).isoformat(),
        experimental=True,
        dataSource="SYNTHETIC",
        datasetVersion=DATA_VERSION,
        datasetSha256=checksum,
        seed=SEED,
        features=FEATURES,
        classes=CLASSES,
        parameters=PARAMETERS,
        libraries=dict(
            python=platform.python_version(),
            sklearn=sklearn.__version__,
            pandas=pd.__version__,
        ),
        artifactSha256=hashlib.sha256(model_file.read_bytes()).hexdigest(),
        trainingRows=len(partitions["train"]),
        totalGeneratedRows=len(frame),
        selectionRule="Highest validation macro-F1 only; no refit on validation/test",
        heldoutRoadIds=heldout,
        splitRanges={
            name: dict(
                rows=len(data),
                first=data.timestamp.min(),
                last=data.timestamp.max(),
                roadIds=sorted(data.road_id.unique().tolist()),
            )
            for name, data in partitions.items()
        },
        evaluation=evaluations,
        limitations=[
            "Synthetic-only evaluation; no actual Sri Lankan traffic validation.",
            "Regions use representative hypothetical arterials, not regional aggregates.",
            "Weather and holidays are user-selected scenarios, not measured or officially forecast data.",
            "No calibrated probabilities, road speeds, journey times or routing overrides are produced.",
        ],
    )
    (output_dir / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    report_path.write_text(json.dumps(metadata, indent=2) + "\n")
    print("Model", version, "selected:", selected)
    for name, result in evaluations.items():
        print(
            name,
            {split: round(value["macro_f1"], 4) for split, value in result.items()},
        )
    return metadata


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--output-dir", type=Path, default=Path("artifacts"))
    p.add_argument("--report", type=Path, default=Path("reports/evaluation.json"))
    a = p.parse_args()
    train(a.output_dir, a.report)
