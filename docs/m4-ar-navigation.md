# M4: Automatic Hybrid AR Navigation

The current implementation is documented in [Automatic Hybrid AR Navigation](m4-hybrid-ar.md), with [validation and limitations](m4-hybrid-validation.md).

The earlier prototype required separate camera/GPS/compass actions and manual route calculation. It has been replaced with a continuously visible guided-preview HUD and automatic confidence-gated real-route transition. There is no Demo AR / Live AR chooser. The existing API, map fallback, safety consent, permission handling and cleanup are retained and extended.

This remains a GPS/compass-assisted camera HUD, not visual road recognition, a world-registered WebXR scene or a physically validated navigation system. Live congestion and traffic-adjusted ETA are unsupported. See the linked documents for exact source labels, thresholds, bounded retries, provider maneuvers and remaining physical-smartphone checks.
