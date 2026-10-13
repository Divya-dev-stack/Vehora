import uuid

PASSWORD = 'TestPass123x'


def test_register_and_login_work(owner):
    assert owner['headers']['Authorization'].startswith('Bearer ')


def test_duplicate_email_is_rejected(client, owner):
    r = client.post('/api/auth/register', json={
        'full_name': 'Duplicate', 'email': owner['email'], 'password': PASSWORD, 'role': 'user'})
    assert r.status_code == 409


def test_wrong_password_returns_401(client, owner):
    r = client.post('/api/auth/login', json={'email': owner['email'], 'password': 'WrongPass999'})
    assert r.status_code == 401


def test_me_requires_token(client):
    assert client.get('/api/auth/me').status_code == 401


def test_me_returns_user_without_password_hash(client, owner):
    r = client.get('/api/auth/me', headers=owner['headers'])
    assert r.status_code == 200
    body = r.json()
    assert body['email'] == owner['email']
    assert body['role'] == 'user'
    assert 'password_hash' not in body and 'password' not in body


def test_cannot_register_as_admin(client):
    r = client.post('/api/auth/register', json={
        'full_name': 'Sneaky', 'email': 'test-' + uuid.uuid4().hex[:8] + '@example.com',
        'password': PASSWORD, 'role': 'admin'})
    assert r.status_code == 422


def test_weak_password_is_rejected(client):
    r = client.post('/api/auth/register', json={
        'full_name': 'Weak', 'email': 'test-' + uuid.uuid4().hex[:8] + '@example.com',
        'password': 'onlyletters', 'role': 'user'})
    assert r.status_code == 422


def test_invalid_token_returns_401(client):
    r = client.get('/api/auth/me', headers={'Authorization': 'Bearer not-a-real-token'})
    assert r.status_code == 401


def test_health_endpoints(client):
    assert client.get('/api/health').status_code == 200
    assert client.get('/api/health/db').status_code == 200