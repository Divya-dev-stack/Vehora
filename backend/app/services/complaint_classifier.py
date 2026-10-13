from functools import lru_cache

import joblib

from app.core.service_types import SERVICE_TYPES
from app.ml.train_complaints import MODEL, normalize

THRESHOLD = 0.40

LABELS = {s["key"]: s["label"] for s in SERVICE_TYPES}
LABELS["other"] = "Not a vehicle problem"

ADVICE = {
    "battery": "Check the battery terminals for looseness or corrosion. A jump start may help, but an old battery usually needs a test or replacement.",
    "starting": "Do not keep cranking the engine repeatedly. Check fuel and battery first, and see a mechanic if it still will not start.",
    "engine": "Avoid hard riding or driving until it is checked. Unusual noise, smoke or power loss should be inspected by a mechanic.",
    "overheating": "Stop in a safe place and switch the engine off. Let it cool fully before opening the coolant cap, and do not continue driving while it is hot.",
    "brakes": "Brake problems are a safety risk. Avoid driving the vehicle and get it checked or towed to a mechanic.",
    "tyres": "Stop in a safe place and do not ride on a flat tyre. Use a puncture repair or tyre replacement service.",
    "electrical": "Check the fuse and bulb first. Repeated fuse failures or a burning smell need a mechanic.",
    "clutch_gearbox": "Avoid forcing the gears. Clutch slipping or gear noise should be inspected soon to prevent more damage.",
    "suspension": "Drive slowly and avoid rough roads. Steering or suspension faults should be inspected before long trips.",
    "oil_service": "Book a general service. Check the service history for the last oil change and the kilometres since.",
}


@lru_cache(maxsize=1)
def _model():
    if not MODEL.exists():
        return None
    return joblib.load(MODEL)


def classify(text):
    model = _model()
    if model is None:
        raise RuntimeError("Model file not found. Run: python -m app.ml.train_complaints")

    probs = model.predict_proba([normalize(text)])[0]
    ranked = sorted(zip(model.classes_, probs), key=lambda p: p[1], reverse=True)
    top_key, top_p = str(ranked[0][0]), float(ranked[0][1])

    clearly_other = top_key == "other" and top_p >= 0.5
    is_vehicle = not clearly_other
    confident = top_key != "other" and top_p >= THRESHOLD

    if not is_vehicle:
        advice = "This does not look like a vehicle problem. Describe the symptom, for example: engine will not start, or brake is soft."
    elif not confident:
        advice = "I am not sure what the problem is. Add more detail, such as when it happens and any sound, smell or warning light."
    else:
        advice = ADVICE.get(top_key, "")

    return {
        "category": top_key,
        "label": LABELS.get(top_key, top_key),
        "confidence": round(top_p, 3),
        "confident": confident,
        "is_vehicle_problem": is_vehicle,
        "advice": advice,
        "alternatives": [
            {"category": str(k), "label": LABELS.get(str(k), str(k)), "confidence": round(float(p), 3)}
            for k, p in ranked[:3]
        ],
        "disclaimer": "Estimate only, from a small self-created dataset. This is not a diagnosis.",
    }

