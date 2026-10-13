SERVICE_TYPES = [
    {"key": "battery", "label": "Battery and charging"},
    {"key": "starting", "label": "Starting problems"},
    {"key": "engine", "label": "Engine and performance"},
    {"key": "overheating", "label": "Overheating and cooling"},
    {"key": "brakes", "label": "Brakes"},
    {"key": "tyres", "label": "Tyres and puncture"},
    {"key": "electrical", "label": "Electrical and lights"},
    {"key": "clutch_gearbox", "label": "Clutch and gearbox"},
    {"key": "suspension", "label": "Suspension and steering"},
    {"key": "oil_service", "label": "Oil change and general service"},
]

SERVICE_KEYS = {s["key"] for s in SERVICE_TYPES}
