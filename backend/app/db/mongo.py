from pymongo import MongoClient

from app.core.config import settings

_client = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        if not settings.mongodb_uri:
            raise RuntimeError("MONGODB_URI is not set in backend/.env")
        _client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    return _client


def get_db():
    return get_client()[settings.mongodb_db]
