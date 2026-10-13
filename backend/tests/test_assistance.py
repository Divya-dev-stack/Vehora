import pytest
from helpers import add_vehicle, service_key, setup_shop

PHONE = '9876543210'


def _request(client, u, v, st, **kw):
    body = {'vehicle_id': v['id'], 'service_type': st, 'contact_phone': PHONE,
            'location_text': 'Near the test landmark', 'description': 'pytest request'}
    body.update(kw)
    return client.post('/api/assistance', headers=u['headers'], json=body)


def _sos(client, u):
    return client.post('/api/assistance', headers=u['headers'],
                       json={'is_sos': True, 'contact_phone': PHONE, 'location_text': 'Test highway'})


def _open_ids(client, mech):
    return [r['id'] for r in client.get('/api/assistance/open', headers=mech['headers']).json()]


def _act(client, who, rid, action):
    return client.post('/api/assistance/' + rid + '/' + action, headers=who['headers'])


def test_full_assistance_flow(client, make, admin):
    owner = make('user')
    mech = make('mechanic')
    other_mech = make('mechanic')
    setup_shop(client, mech, 'Pytest Shop A')
    setup_shop(client, other_mech, 'Pytest Shop B')
    v = add_vehicle(client, owner)
    st = service_key(client, owner['headers'])

    r = _request(client, owner, v, st)
    assert r.status_code == 201, r.text
    req = r.json()
    assert req['status'] == 'open'
    assert 'contact_phone' not in req
    assert _request(client, owner, v, st).status_code == 400

    rows = client.get('/api/assistance/open', headers=mech['headers']).json()
    seen = [x for x in rows if x['id'] == req['id']][0]
    assert seen['contact_phone'] is None
    assert seen['location_text'] is None
    assert seen['latitude'] is None

    adm = client.get('/api/admin/requests', headers=admin['headers'])
    assert adm.status_code == 200 and PHONE not in adm.text

    assert _act(client, mech, req['id'], 'accept').status_code == 200
    assert _act(client, other_mech, req['id'], 'accept').status_code == 409
    assert req['id'] not in _open_ids(client, mech)

    jobs = client.get('/api/assistance/jobs', headers=mech['headers']).json()
    job = [j for j in jobs if j['id'] == req['id']][0]
    assert job['contact_phone'] == PHONE
    assert job['location_text'] == 'Near the test landmark'

    mine = client.get('/api/assistance/mine', headers=owner['headers']).json()
    m = [x for x in mine if x['id'] == req['id']][0]
    assert m['status'] == 'accepted' and m['mechanic_shop'] == 'Pytest Shop A'

    assert _act(client, other_mech, req['id'], 'complete').status_code == 404
    assert _act(client, mech, req['id'], 'complete').status_code == 200
    mine = client.get('/api/assistance/mine', headers=owner['headers']).json()
    assert [x for x in mine if x['id'] == req['id']][0]['status'] == 'completed'
    assert _request(client, owner, v, st).status_code == 201


def test_release_and_cancel(client, make):
    owner = make('user')
    stranger = make('user')
    mech = make('mechanic')
    setup_shop(client, mech, 'Pytest Shop C')
    v = add_vehicle(client, owner)
    st = service_key(client, owner['headers'])
    req = _request(client, owner, v, st).json()
    assert _act(client, mech, req['id'], 'accept').status_code == 200
    assert _act(client, mech, req['id'], 'release').status_code == 200
    mine = client.get('/api/assistance/mine', headers=owner['headers']).json()
    row = [x for x in mine if x['id'] == req['id']][0]
    assert row['status'] == 'open' and row['mechanic_shop'] is None
    assert _act(client, stranger, req['id'], 'cancel').status_code == 404
    assert _act(client, owner, req['id'], 'cancel').status_code == 200
    assert _act(client, owner, req['id'], 'cancel').status_code == 404
    mine = client.get('/api/assistance/mine', headers=owner['headers']).json()
    assert [x for x in mine if x['id'] == req['id']][0]['status'] == 'cancelled'


@pytest.mark.parametrize('changes', [
    {'location_text': None}, {'contact_phone': '123'}, {'service_type': 'nonsense'},
    {'latitude': 13.0}, {'vehicle_id': None},
])
def test_invalid_request_is_rejected(client, make, changes):
    u = make('user')
    v = add_vehicle(client, u)
    st = service_key(client, u['headers'])
    assert _request(client, u, v, st, **changes).status_code == 422


def test_cannot_request_help_for_someones_vehicle(client, make):
    a = make('user')
    b = make('user')
    v = add_vehicle(client, a)
    st = service_key(client, b['headers'])
    assert _request(client, b, v, st).status_code == 404


def test_sos_is_visible_to_any_available_mechanic(client, make):
    owner = make('user')
    mech = make('mechanic')
    setup_shop(client, mech, 'Pytest Shop D')
    r = _sos(client, owner)
    assert r.status_code == 201, r.text
    assert r.json()['is_sos'] is True and r.json()['service_type'] == 'emergency'
    assert r.json()['id'] in _open_ids(client, mech)


def test_unavailable_mechanic_sees_nothing_and_cannot_accept(client, make):
    owner = make('user')
    mech = make('mechanic')
    setup_shop(client, mech, 'Pytest Shop E', available=False)
    req = _sos(client, owner).json()
    assert client.get('/api/assistance/open', headers=mech['headers']).json() == []
    assert _act(client, mech, req['id'], 'accept').status_code == 400
    setup_shop(client, mech, 'Pytest Shop E', available=True)
    assert req['id'] in _open_ids(client, mech)


def test_mechanic_can_hold_at_most_three_active_jobs(client, make):
    mech = make('mechanic')
    setup_shop(client, mech, 'Pytest Shop F')
    ids = []
    for _ in range(4):
        ids.append(_sos(client, make('user')).json()['id'])
    for rid in ids[:3]:
        assert _act(client, mech, rid, 'accept').status_code == 200
    assert _act(client, mech, ids[3], 'accept').status_code == 400