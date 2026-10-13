import pytest
from helpers import add_vehicle, vehicle_body, vehicle_type_key


def test_vehicle_crud_cycle(client, make):
    u = make('user')
    v = add_vehicle(client, u)
    assert 'owner_id' not in v
    got = client.get('/api/vehicles/' + v['id'], headers=u['headers'])
    assert got.status_code == 200 and got.json()['make'] == 'Test'
    ids = [x['id'] for x in client.get('/api/vehicles', headers=u['headers']).json()]
    assert ids == [v['id']]
    body = vehicle_body(v['vehicle_type'], make='Changed', mileage_km=2500)
    up = client.put('/api/vehicles/' + v['id'], headers=u['headers'], json=body)
    assert up.status_code == 200
    assert up.json()['make'] == 'Changed' and up.json()['mileage_km'] == 2500
    assert client.delete('/api/vehicles/' + v['id'], headers=u['headers']).status_code == 204
    assert client.get('/api/vehicles/' + v['id'], headers=u['headers']).status_code == 404


@pytest.mark.parametrize('changes', [
    {'year': 1970}, {'year': 3000}, {'fuel_type': 'steam'}, {'mileage_km': -5},
    {'registration_number': '@@'}, {'make': '   '}, {'last_service_date': '2999-01-01'},
])
def test_invalid_vehicle_is_rejected(client, owner, changes):
    vt = vehicle_type_key(client, owner['headers'])
    r = client.post('/api/vehicles', headers=owner['headers'], json=vehicle_body(vt, **changes))
    assert r.status_code == 422


def test_unknown_vehicle_type_is_rejected(client, owner):
    r = client.post('/api/vehicles', headers=owner['headers'], json=vehicle_body('spaceship'))
    assert r.status_code == 422


def test_other_owner_cannot_touch_my_vehicle(client, make):
    a = make('user')
    b = make('user')
    v = add_vehicle(client, a)
    path = '/api/vehicles/' + v['id']
    assert client.get(path, headers=b['headers']).status_code == 404
    body = vehicle_body(v['vehicle_type'], make='Hacked')
    assert client.put(path, headers=b['headers'], json=body).status_code == 404
    assert client.delete(path, headers=b['headers']).status_code == 404
    assert client.get(path, headers=a['headers']).json()['make'] == 'Test'
    assert client.get('/api/vehicles', headers=b['headers']).json() == []


def test_bad_vehicle_id_returns_404(client, owner):
    assert client.get('/api/vehicles/not-an-id', headers=owner['headers']).status_code == 404


def test_vehicle_limit_is_20(client, make):
    u = make('user')
    for _ in range(20):
        add_vehicle(client, u)
    vt = vehicle_type_key(client, u['headers'])
    r = client.post('/api/vehicles', headers=u['headers'], json=vehicle_body(vt))
    assert r.status_code == 400