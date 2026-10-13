def test_admin_stats_shape(client, admin):
    r = client.get('/api/admin/stats', headers=admin['headers'])
    assert r.status_code == 200
    body = r.json()
    for key in ('users', 'mechanics', 'vehicles', 'assistance', 'complaints'):
        assert key in body


def test_users_list_hides_password_hash(client, admin, owner):
    r = client.get('/api/admin/users', headers=admin['headers'])
    assert r.status_code == 200
    assert 'password_hash' not in r.text
    assert owner['email'] in [u['email'] for u in r.json()]


def test_admin_cannot_deactivate_self(client, admin):
    r = client.post('/api/admin/users/' + admin['id'] + '/deactivate', headers=admin['headers'])
    assert r.status_code == 400


def test_admin_cannot_deactivate_another_admin(client, admin, make):
    other = make('admin')
    r = client.post('/api/admin/users/' + other['id'] + '/deactivate', headers=admin['headers'])
    assert r.status_code == 400


def test_deactivated_user_cannot_log_in_until_reactivated(client, admin, make):
    victim = make('user')
    off = client.post('/api/admin/users/' + victim['id'] + '/deactivate', headers=admin['headers'])
    assert off.status_code == 200
    blocked = client.post('/api/auth/login', json={'email': victim['email'], 'password': 'TestPass123x'})
    assert blocked.status_code == 401
    still = client.get('/api/auth/me', headers=victim['headers'])
    assert still.status_code == 401
    on = client.post('/api/admin/users/' + victim['id'] + '/activate', headers=admin['headers'])
    assert on.status_code == 200
    again = client.post('/api/auth/login', json={'email': victim['email'], 'password': 'TestPass123x'})
    assert again.status_code == 200


def test_unknown_ids_return_404(client, admin):
    assert client.post('/api/admin/mechanics/not-an-id/verify', headers=admin['headers']).status_code == 404
    assert client.post('/api/admin/users/not-an-id/deactivate', headers=admin['headers']).status_code == 404


def test_verify_and_unverify_mechanic(client, admin, make):
    mech = make('mechanic')
    vt = client.get('/api/vehicle-types', headers=mech['headers']).json()['types'][0]['key']
    st = client.get('/api/mechanics/meta', headers=mech['headers']).json()['service_types'][0]['key']
    saved = client.put('/api/mechanics/me', headers=mech['headers'], json={
        'shop_name': 'Pytest Garage', 'phone': '9876543210', 'city': 'Chennai',
        'vehicle_types': [vt], 'service_types': [st], 'is_available': True})
    assert saved.status_code == 200, saved.text
    assert saved.json()['verified'] is False

    def find():
        rows = client.get('/api/admin/mechanics', headers=admin['headers']).json()
        return [m for m in rows if m['shop_name'] == 'Pytest Garage'][0]

    m = find()
    assert m['verified'] is False
    assert client.post('/api/admin/mechanics/' + m['id'] + '/verify', headers=admin['headers']).status_code == 200
    assert find()['verified'] is True
    assert client.get('/api/mechanics/me', headers=mech['headers']).json()['verified'] is True
    assert client.post('/api/admin/mechanics/' + m['id'] + '/unverify', headers=admin['headers']).status_code == 200
    assert find()['verified'] is False