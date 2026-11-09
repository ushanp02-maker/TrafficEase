"""Seeded hypothetical traffic scenarios. No external observations or actual holiday calendar."""

import argparse
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import numpy as np
import pandas as pd
from scenarios import ROAD_TARGETS, WEATHER, features_for

SEED = 20261109
DATA_VERSION = "hypothetical-lk-v1"


def generate(seed=SEED, days=120):
    rng = np.random.default_rng(seed)
    start = datetime(2025, 1, 1, tzinfo=ZoneInfo("Asia/Colombo"))
    rows = []
    for day in range(days):
        for road in ROAD_TARGETS:
            for hour in range(24):
                at = start + timedelta(days=day, hours=hour)
                holiday = (
                    day % 17 == 0
                )  # Fictional scenario schedule, NOT official Sri Lankan holidays.
                weather = str(rng.choice(WEATHER, p=[0.65, 0.25, 0.10]))
                features = features_for(road, at, weather, holiday)
                peak = (7 <= hour <= 9 or 16 <= hour <= 19) and at.weekday() < 5
                score = (
                    0.25
                    + 1.5 * peak
                    + 0.35 * (10 <= hour <= 15)
                    + {"ARTERIAL": 0.55, "LOCAL": 0.1, "HIGHWAY": -0.2}[
                        road["road_class"]
                    ]
                    + {"CLEAR": 0, "RAIN": 0.45, "HEAVY_RAIN": 0.9}[weather]
                    + (0.25 if road["region"] == "Western" else 0)
                    - 0.4 * holiday
                    + rng.normal(0, 0.4)
                )
                label = "LOW" if score < 0.9 else "MODERATE" if score < 1.8 else "HIGH"
                rows.append(
                    dict(
                        timestamp=at.isoformat(),
                        road_id=road["id"],
                        **features,
                        congestion=label,
                        source="SYNTHETIC",
                        experimental=True,
                    )
                )
    return pd.DataFrame(rows)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--output", default="data/generated/traffic.csv")
    p.add_argument("--seed", type=int, default=SEED)
    a = p.parse_args()
    out = Path(a.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    frame = generate(a.seed)
    frame.to_csv(out, index=False, lineterminator="\n")
    print(f"Wrote {len(frame)} SYNTHETIC rows to {out}; not measured traffic.")
