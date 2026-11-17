"""Measured route geometry descriptors, not guessed OSM tags or observed congestion."""
import hashlib
import json
import math
FEATURE_VERSION = "mapped-route-shape-v1"
FEATURES = ["directness", "turns_per_km", "hour", "weekday", "weather"]
CLASSES = ["LOW", "MODERATE", "HIGH"]
WEATHER = ["CLEAR", "RAIN", "HEAVY_RAIN"]


def metres(a, b):
    p, q = map(math.radians, [a[1], b[1]])
    h = math.sin((q-p)/2)**2 + math.cos(p)*math.cos(q)*math.sin(math.radians(b[0]-a[0])/2)**2
    return 6371000*2*math.asin(min(1, math.sqrt(h)))


def bearing(a, b):
    p, q = map(math.radians, [a[1], b[1]])
    dl = math.radians(b[0]-a[0])
    return math.degrees(math.atan2(math.sin(dl)*math.cos(q), math.cos(p)*math.sin(q)-math.sin(p)*math.cos(q)*math.cos(dl)))


def sample_geometry(points, step=250):
    """Distance-based resampling; raw vertex density is not a road characteristic."""
    result = [points[0]]
    until = step
    traversed = 0.0
    for a, b in zip(points, points[1:]):
        length = metres(a, b)
        if length == 0:
            continue
        while until <= traversed + length:
            t = (until-traversed)/length
            result.append([a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])])
            until += step
        traversed += length
    if metres(result[-1], points[-1]) > 1:
        result.append(points[-1])
    return result


def extract(route):
    points = route["geometry"]["coordinates"]
    if route["geometry"].get("type") != "LineString" or not 2 <= len(points) <= 50000:
        raise ValueError("Unsupported route geometry")
    for p in points:
        if len(p) != 2 or not all(isinstance(v, (int,float)) and math.isfinite(v) for v in p) or not (79.4 <= p[0] <= 82.1 and 5.8 <= p[1] <= 10.1):
            raise ValueError("Geometry outside the Sri Lankan study bounds")
    distance = route.get("distanceMeters", route.get("distance"))
    if not isinstance(distance,(int,float)) or not math.isfinite(distance) or not 100 <= distance <= 600000:
        raise ValueError("Route distance outside the documented 0.1–600 km study envelope")
    length = sum(metres(a,b) for a,b in zip(points,points[1:]))
    if abs(length-distance) > max(100, distance*.08):
        raise ValueError("Route geometry and provider distance are inconsistent")
    direct = metres(points[0],points[-1])
    if direct < 100:
        raise ValueError("Endpoints too close for a stable route-level ratio")
    directness = distance/direct
    if not .95 <= directness <= 6:
        raise ValueError("Directness outside the predefined model envelope")
    samples = sample_geometry(points)
    headings = [bearing(a,b) for a,b in zip(samples,samples[1:])]
    turns = sum(abs((b-a+180)%360-180) >= 30 for a,b in zip(headings,headings[1:]))
    density = turns/(distance/1000)
    if not 0 <= density <= 5:
        raise ValueError("Turn density outside the predefined model envelope")
    return dict(distance_km=distance/1000, directness=directness, turns_per_km=density,
                geometrySha256=hashlib.sha256(json.dumps(points,separators=(',',':')).encode()).hexdigest(),
                featureVersion=FEATURE_VERSION, roadClass=None, laneCount=None, speedLimitKph=None,
                missingMapTags=["road_class","lanes","maxspeed"],
                note="OSRM supplies geometry, not lane/class/speed-limit tags. Unknown tags are excluded, never imputed.")


def feature_row(shape, at, weather):
    return {"directness":shape["directness"],"turns_per_km":shape["turns_per_km"],"hour":at.hour,"weekday":at.weekday(),"weather":weather}
