"""Hypothetical scenarios, never observed Sri Lankan roads."""

REGIONS = [
    "Western",
    "Central",
    "Southern",
    "Northern",
    "Eastern",
    "North Western",
    "North Central",
    "Uva",
    "Sabaragamuwa",
]
WEATHER = ["CLEAR", "RAIN", "HEAVY_RAIN"]
ROAD_TYPES = [
    ("urban", "ARTERIAL", 4, 50),
    ("local", "LOCAL", 2, 40),
    ("highway", "HIGHWAY", 4, 80),
]
ROAD_TARGETS = [
    dict(
        id=f"{region.lower().replace(' ','-')}-{kind}",
        name=f"{region} · hypothetical {kind} corridor",
        kind="ROAD_SCENARIO",
        region=region,
        road_class=road_class,
        lanes=lanes,
        speed_limit_kph=speed,
    )
    for region in REGIONS
    for kind, road_class, lanes, speed in ROAD_TYPES
]
REGION_TARGETS = [
    {
        **next(
            r
            for r in ROAD_TARGETS
            if r["region"] == region and r["road_class"] == "ARTERIAL"
        ),
        "id": "region-" + region.lower().replace(" ", "-"),
        "name": region + " · representative hypothetical arterial",
        "kind": "REGION_SCENARIO",
    }
    for region in REGIONS
]
TARGETS = ROAD_TARGETS + REGION_TARGETS
FEATURES = [
    "region",
    "road_class",
    "lanes",
    "speed_limit_kph",
    "hour",
    "weekday",
    "is_holiday",
    "weather",
]
CATEGORICAL = ["region", "road_class", "weather"]
NUMERIC = [f for f in FEATURES if f not in CATEGORICAL]
CLASSES = ["LOW", "MODERATE", "HIGH"]


def features_for(target, at, weather, is_holiday):
    return {
        **{k: target[k] for k in ["region", "road_class", "lanes", "speed_limit_kph"]},
        "hour": at.hour,
        "weekday": at.weekday(),
        "is_holiday": int(is_holiday),
        "weather": weather,
    }
