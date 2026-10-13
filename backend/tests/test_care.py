import pytest
from helpers import add_vehicle, iso, service_key


def _record(client, u, vehicle_id, st, **kw):
    body = {'vehicle_id': vehicle_id, 'service_date': iso(0), 'service_type': st, 'odometer_km': 2000}
    body.update(kw)
    return client.post('/api/service-records', headers=u['headers'], json=body)


def test_record_updates_vehicle_and_creates_reminder(client, make):
    u = make('user')
    v = add_vehicle(client, u, mileage_km=1000)
    st = service_key(client, u['headers'])
    r = _record(client, u, v['id'], st, service_date=iso(-3), odometer_km=2000, next_due_km=7000, cost=500)
    assert r.status_code == 201, r.text
    veh = client.get('/api/vehicles/' + v['id'], headers=u['headers']).json()
    assert veh['mileage_km'] == 2000
    assert veh['last_service_date'] == iso(-3)
    rem = client.get('/api/reminders', headers=u['headers']).json()
    assert len(rem) == 1
    assert rem[0]['due_km'] == 7000 and rem[0]['status'] == 'upcoming'


def test_lower_odometer_does_not_reduce_mileage(client, make):
    u = make('user')
    v = add_vehicle(client, u, mileage_km=5000)
    st = service_key(client, u['headers'])
    assert _record(client, u, v['id'], st, odometer_km=3000).status_code == 201
    veh = client.get('/api/vehicles/' + v['id'], headers=u['headers']).json()
    assert veh['mileage_km'] == 5000


def test_older_record_does_not_move_last_service_date(client, make):
    u = make('user')
    v = add_vehicle(client, u)
    st = service_key(client, u['headers'])
    assert _record(client, u, v['id'], st, service_date=iso(-3)).status_code == 201
    assert _record(client, u, v['id'], st, service_date=iso(-30)).status_code == 201
    veh = client.get('/api/vehicles/' + v['id'], headers=u['headers']).json()
    assert veh['last_service_date'] == iso(-3)


@pytest.mark.parametrize('changes', [
    {'service_date': iso(5)}, {'next_due_date': iso(-1)}, {'next_due_km': 100},
    {'service_type': 'nonsense'}, {'odometer_km': -1},
])
def test_invalid_service_record_is_rejected(client, make, changes):
    u = make('user')
    v = add_vehicle(client, u)
    st = service_key(client, u['headers'])
    assert _record(client, u, v['id'], st, **changes).status_code == 422


def test_records_are_private_and_deletable(client, make):
    a = make('user')
    b = make('user')
    v = add_vehicle(client, a)
    st = service_key(client, a['headers'])
    rec = _record(client, a, v['id'], st).json()
    assert _record(client, b, v['id'], st).status_code == 404
    b_ids = [x['id'] for x in client.get('/api/service-records', headers=b['headers']).json()]
    assert rec['id'] not in b_ids
    assert client.delete('/api/service-records/' + rec['id'], headers=b['headers']).status_code == 404
    a_ids = [x['id'] for x in client.get('/api/service-records', headers=a['headers']).json()]
    assert rec['id'] in a_ids
    assert client.delete('/api/service-records/' + rec['id'], headers=a['headers']).status_code == 200
    assert client.delete('/api/service-records/' + rec['id'], headers=a['headers']).status_code == 404


@pytest.mark.parametrize('due, expected', [
    ({'due_date': iso(-1)}, 'overdue'),
    ({'due_date': iso(5)}, 'due_soon'),
    ({'due_date': iso(60)}, 'upcoming'),
    ({'due_km': 1000}, 'overdue'),
    ({'due_km': 1200}, 'due_soon'),
    ({'due_km': 5000}, 'upcoming'),
])
def test_reminder_status(client, make, due, expected):
    u = make('user')
    v = add_vehicle(client, u, mileage_km=1000)
    r = client.post('/api/reminders', headers=u['headers'],
                    json={'vehicle_id': v['id'], 'title': 'Check', **due})
    assert r.status_code == 201, r.text
    assert r.json()['status'] == expected


def test_reminder_needs_a_due_date_or_km(client, make):
    u = make('user')
    v = add_vehicle(client, u)
    r = client.post('/api/reminders', headers=u['headers'], json={'vehicle_id': v['id'], 'title': 'Check'})
    assert r.status_code == 422


def test_reminder_done_and_delete(client, make):
    a = make('user')
    b = make('user')
    v = add_vehicle(client, a)
    r = client.post('/api/reminders', headers=a['headers'],
                    json={'vehicle_id': v['id'], 'title': 'Check', 'due_date': iso(30)})
    rid = r.json()['id']
    assert client.post('/api/reminders/' + rid + '/done', headers=b['headers']).status_code == 404
    assert client.post('/api/reminders/' + rid + '/done', headers=a['headers']).status_code == 200
    active = [x['id'] for x in client.get('/api/reminders', headers=a['headers']).json()]
    assert rid not in active
    all_rows = client.get('/api/reminders', params={'include_done': True}, headers=a['headers']).json()
    done = [x for x in all_rows if x['id'] == rid][0]
    assert done['status'] == 'done'
    assert client.delete('/api/reminders/' + rid, headers=b['headers']).status_code == 404
    assert client.delete('/api/reminders/' + rid, headers=a['headers']).status_code == 200
    assert client.delete('/api/reminders/' + rid, headers=a['headers']).status_code == 404