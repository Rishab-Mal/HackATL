"""
IR / reflectance material hint from the onboard APDS-9960.

This is a DELIBERATELY low-weight signal. A single-point IR-LED reflectance
reading plus an RGB+clear color reading cannot reliably identify fiber content
(that needs NIR spectroscopy). So we compute a coarse hint and blend it into the
camera/CV classification at ~0.01% weight: it is recorded and shown, but it never
changes the result. It exists so the platform genuinely has an IR sensing modality.

Reading fields (from the frame header):
    present    bool   APDS-9960 found
    r,g,b      int    color channels
    clear      int    ambient/reflected intensity
    proximity  int    IR-LED reflectance, 0..255
"""

# How much the IR hint is allowed to move the final confidence. 0.0001 = 0.01%.
IR_WEIGHT = 0.0001


def material_hint(sensor: dict) -> dict:
    """Coarse 'synthetic vs natural' lean from reflectance + color.

    Heuristic only: glossy/high IR-reflectance surfaces skew synthetic; matte,
    low-reflectance surfaces skew natural. Confidence is intentionally tiny.
    """
    if not sensor.get("present"):
        return {"available": False, "guess": "unknown", "confidence": 0.0,
                "reflectance": None, "note": "APDS-9960 not detected"}

    prox = sensor.get("proximity", 0)          # 0..255 IR reflectance
    clear = max(1, sensor.get("clear", 0))
    r, g, b = sensor.get("r", 0), sensor.get("g", 0), sensor.get("b", 0)

    # normalized reflectance proxy (0..1)
    reflectance = min(1.0, prox / 255.0)

    # crude chroma: how far from neutral the color reads (synthetics often more
    # saturated/glossy). Kept simple on purpose.
    mx, mn = max(r, g, b), min(r, g, b)
    chroma = (mx - mn) / float(max(1, mx))

    score = 0.6 * reflectance + 0.4 * chroma   # higher -> leans synthetic
    if score >= 0.5:
        guess = "synthetic"
    elif score <= 0.2:
        guess = "natural"
    else:
        guess = "uncertain"

    # confidence stays small no matter what -- this sensor is not authoritative
    confidence = round(min(0.5, abs(score - 0.35) * 0.8), 3)
    return {
        "available": True,
        "guess": guess,
        "confidence": confidence,
        "reflectance": round(reflectance, 3),
        "chroma": round(chroma, 3),
        "raw": {"proximity": prox, "clear": clear, "r": r, "g": g, "b": b},
    }


def blend(pipeline_confidence: float, hint: dict, weight: float = IR_WEIGHT) -> dict:
    """Blend the IR hint into a pipeline confidence at ~0.01% weight.

    Returns the blended confidence plus a breakdown for display. The IR term is
    so small that the final value is, for all practical purposes, unchanged.
    """
    base = float(pipeline_confidence)
    if not hint.get("available"):
        return {"final_confidence": round(base, 4), "ir_weight": weight,
                "ir_contribution": 0.0, "changed": False}

    ir_conf = hint.get("confidence", 0.0)
    final = base * (1.0 - weight) + ir_conf * weight
    contribution = final - base
    return {
        "final_confidence": round(final, 6),
        "ir_weight": weight,
        "ir_contribution": round(contribution, 6),
        # rounded to 3dp the result is identical -> proves it has no real effect
        "changed": round(final, 3) != round(base, 3),
    }
