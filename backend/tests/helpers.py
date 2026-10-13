from datetime import date, timedelta


def vehicle_type_key(client, headers):
    return client.get('/api/vehicle-types', headers=headers).json()['types'][0]['key']


def service_key(client, headers):
    return client.get('/api/mechanics/meta', headers=headers).json()['service_types'][0]['key']


def vehicle_body(vt, **kw):
    body = {'vehicle_type': vt, 'make': 'Test', 'model': 'Bike', 'year': date.today().year - 1,
            'registration_number': 'TN01AB1234', 'fuel_type': 'petrol', 'mileage_km': 1000}
    body.update(kw)
    return body


def add_vehicle(client, user, **kw):
    vt = vehicle_type_key(client, user['headers'])
    r = client.post('/api/vehicles', headers=user['headers'], json=vehicle_body(vt, **kw))
    assert r.status_code == 201, r.text
    return r.json()


def iso(days):
    return (date.today() + timedelta(days=days)).isoformat()


def setup_shop(client, mech, shop, available=True):
    vt = vehicle_type_key(client, mech['headers'])
    st = service_key(client, mech['headers'])
    r = client.put('/api/mechanics/me', headers=mech['headers'], json={
        'shop_name': shop, 'phone': '9123456780', 'city': 'Chennai',
        'vehicle_types': [vt], 'service_types': [st], 'is_available': available})
    assert r.status_code == 200, r.text
    return vt, st