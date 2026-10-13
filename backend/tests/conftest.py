import os

os.environ['MONGODB_DB'] = 'vehora_test'
os.environ['JWT_SECRET'] = 'pytest-only-secret-not-for-real-use-0123456789'

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import hash_password
from app.db.mongo import get_client, get_db
from app.main import app

TEST_DB = 'vehora_test'
PASSWORD = 'TestPass123x'


def _email(prefix):
    return 'test-' + prefix + '-' + uuid.uuid4().hex[:8] + '@example.com'


def _login(client, email):
    r = client.post('/api/auth/login', json={'email': email, 'password': PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    return {
        'id': data['user']['id'],
        'email': email,
        'headers': {'Authorization': 'Bearer ' + data['access_token']},
    }


def _make(client, role):
    email = _email(role)
    if role == 'admin':
        get_db().users.insert_one({
            'full_name': 'Test admin',
            'email': email,
            'phone': None,
            'password_hash': hash_password(PASSWORD),
            'role': 'admin',
            'is_active': True,
            'created_at': datetime.now(timezone.utc),
        })
    else:
        r = client.post('/api/auth/register', json={
            'full_name': 'Test ' + role,
            'email': email,
            'password': PASSWORD,
            'role': role,
        })
        assert r.status_code == 201, r.text
    return _login(client, email)


@pytest.fixture(scope='session')
def client():
    assert settings.mongodb_db == TEST_DB, 'Refusing to run: not using the test database'
    get_client().drop_database(TEST_DB)
    with TestClient(app) as c:
        yield c
    assert settings.mongodb_db == TEST_DB
    get_client().drop_database(TEST_DB)


@pytest.fixture(scope='session')
def make(client):
    return lambda role: _make(client, role)


@pytest.fixture(scope='session')
def owner(make):
    return make('user')


@pytest.fixture(scope='session')
def mechanic(make):
    return make('mechanic')


@pytest.fixture(scope='session')
def admin(make):
    return make('admin')