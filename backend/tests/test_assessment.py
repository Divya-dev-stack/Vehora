from datetime import date

from helpers import add_vehicle, iso, service_key, vehicle_body


def assess(client, u, vid):
    r = client.get('/api/assessment/' + vid, headers=u['headers'])
    assert r.status_code == 200, r.text
    return r.json()


def points(data):
    return {f['key']: f['points'] for f in data['factors']}


def test_no_service_data_gives_75_and_limited_quality(client, make):
    u = make('user')
    v = add_vehicle(client, u)
    d = assess(client, u, v['id'])
    assert d['score'] == 75
    assert d['status'] == 'fair'
    assert d['data_quality'] == 'limited'
    assert points(d)['service_gap'] == -25
    assert len(d['factors']) == 5
    assert 'Estimate only' in d['disclaimer']


def test_recent_service_gives_100(client, make):
    u = make('user')
    v = add_vehicle(client, u, mileage_km=1000)
    st = service_key(client, u['headers'])
    r = client.post('/api/service-records', headers=u['headers'], json={
        'vehicle_id': v['id'], 'service_date': iso(0), 'service_type': st, 'odometer_km': 1000})
    assert r.status_code == 201, r.text
    d = assess(client, u, v['id'])
    assert d['score'] == 100
    assert d['status'] == 'good'
    assert d['data_quality'] == 'ok'


def test_overdue_reminder_lowers_score_by_12(client, make):
    u = make('user')
    v = add_vehicle(client, u, mileage_km=1000)
    st = service_key(client, u['headers'])
    client.post('/api/service-records', headers=u['headers'], json={
        'vehicle_id': v['id'], 'service_date': iso(0), 'service_type': st, 'odometer_km': 1000})
    r = client.post('/api/reminders', headers=u['headers'],
                    json={'vehicle_id': v['id'], 'title': 'Late', 'due_date': iso(-1)})
    assert r.status_code == 201
    d = assess(client, u, v['id'])
    assert d['score'] == 88
    assert points(d)['reminders'] == -12
    assert 'Complete your overdue maintenance reminders.' in d['recommendations']


def test_old_high_km_vehicle_is_poor(client, make):
    u = make('user')
    v = add_vehicle(client, u, year=2000, mileage_km=150000)
    d = assess(client, u, v['id'])
    assert d['score'] == 50
    assert d['status'] == 'poor'
    p = points(d)
    assert p['age'] == -15 and p['odometer'] == -10


def test_many_km_since_service_costs_20_points(client, make):
    u = make('user')
    v = add_vehicle(client, u, mileage_km=1000)
    st = service_key(client, u['headers'])
    client.post('/api/service-records', headers=u['headers'], json={
        'vehicle_id': v['id'], 'service_date': iso(0), 'service_type': st, 'odometer_km': 1000})
    body = vehicle_body(v['vehicle_type'], mileage_km=20000)
    assert client.put('/api/vehicles/' + v['id'], headers=u['headers'], json=body).status_code == 200
    d = assess(client, u, v['id'])
    assert points(d)['km_since_service'] == -20
    assert d['score'] == 80


def test_assessment_access_rules(client, make, admin):
    a = make('user')
    b = make('user')
    v = add_vehicle(client, a)
    path = '/api/assessment/' + v['id']
    assert client.get(path, headers=b['headers']).status_code == 404
    assert client.get(path, headers=admin['headers']).status_code == 403
    assert client.get(path).status_code == 401
    assert client.get('/api/assessment/not-an-id', headers=a['headers']).status_code == 404