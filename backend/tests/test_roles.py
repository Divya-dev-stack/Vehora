import pytest

ADMIN_PATHS = ['/api/admin/stats', '/api/admin/users', '/api/admin/mechanics', '/api/admin/requests']
OWNER_ONLY = ['/api/vehicles', '/api/reminders', '/api/service-records', '/api/assistance/mine']
MECHANIC_ONLY = ['/api/mechanics/me', '/api/assistance/open', '/api/assistance/jobs']


@pytest.mark.parametrize('path', ADMIN_PATHS)
def test_owner_cannot_use_admin_api(client, owner, path):
    assert client.get(path, headers=owner['headers']).status_code == 403


@pytest.mark.parametrize('path', ADMIN_PATHS)
def test_mechanic_cannot_use_admin_api(client, mechanic, path):
    assert client.get(path, headers=mechanic['headers']).status_code == 403


@pytest.mark.parametrize('path', ADMIN_PATHS + OWNER_ONLY + MECHANIC_ONLY)
def test_no_token_returns_401(client, path):
    assert client.get(path).status_code == 401


@pytest.mark.parametrize('path', OWNER_ONLY)
def test_mechanic_cannot_use_owner_api(client, mechanic, path):
    assert client.get(path, headers=mechanic['headers']).status_code == 403


@pytest.mark.parametrize('path', MECHANIC_ONLY)
def test_owner_cannot_use_mechanic_api(client, owner, path):
    assert client.get(path, headers=owner['headers']).status_code == 403


@pytest.mark.parametrize('path', OWNER_ONLY)
def test_admin_cannot_use_owner_api(client, admin, path):
    assert client.get(path, headers=admin['headers']).status_code == 403