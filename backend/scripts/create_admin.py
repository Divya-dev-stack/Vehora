import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.security import hash_password
from app.db.mongo import get_db

EMAIL = "admin@example.com"
import getpass; PASSWORD = getpass.getpass("Admin password: ")

db = get_db()
db.users.update_one(
    {"email": EMAIL},
    {
        "$set": {
            "full_name": "VEHORA Admin",
            "email": EMAIL,
            "phone": None,
            "password_hash": hash_password(PASSWORD),
            "role": "admin",
            "is_active": True,
        },
        "$setOnInsert": {"created_at": datetime.now(timezone.utc)},
    },
    upsert=True,
)
print("Admin account ready:", EMAIL)
