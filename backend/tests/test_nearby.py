from helpers import service_key, setup_shop, vehicle_type_key

LAT, LNG = 13.0827, 80.2707


def _share(client, mech, **kw):
    body = {'latitude': 13.0830, 'longitude': 80.2710, 'consent': True}
    body.update(kw)
    return client.put('/api/mechanics/me/location', headers=mech['headers'], json=body)


def _names(client, owner, **params):
    q = {'lat': LAT, 'lng': LNG, 'radius_km': 5}
    q.update(params)
    r = client.get('/api/mechanics/nearby', params=q, headers=owner['headers'])
    assert r.status_code == 200, r.text
    return {x['shop_name']: x for x in r.json()}


def test_location_needs_consent_and_a_profile(client, make):
    no_profile = make('mechanic')
    assert _share(client, no_profile).status_code == 404
    mech = make('mechanic')
    setup_shop(client, mech, 'Pytest Nearby Z')
    assert _share(client, mech, consent=False).status_code == 400
    assert _share(client, mech, latitude=91).status_code == 422


def test_nearby_search_and_privacy_controls(client, make, owner):
    mech = make('mechanic')
    vt, st = setup_shop(client, mech, 'Pytest Nearby A')
    r = _share(client, mech)
    assert r.status_code == 200 and r.json()['shared'] is True

    found = _names(client, owner)
    assert 'Pytest Nearby A' in found
    assert found['Pytest Nearby A']['distance_km'] < 1
    assert found['Pytest Nearby A']['verified'] is False
    assert 'Pytest Nearby A' in _names(client, owner, service=st, vehicle_type=vt)
    assert 'Pytest Nearby A' not in _names(client, owner, lat=28.61, lng=77.20)

    setup_shop(client, mech, 'Pytest Nearby A', available=False)
    assert 'Pytest Nearby A' not in _names(client, owner)
    setup_shop(client, mech, 'Pytest Nearby A', available=True)
    assert 'Pytest Nearby A' in _names(client, owner)

    assert client.delete('/api/mechanics/me/location', headers=mech['headers']).status_code == 200
    assert 'Pytest Nearby A' not in _names(client, owner)


def test_nearby_rules(client, owner, mechanic):
    bad = client.get('/api/mechanics/nearby', params={'lat': LAT, 'lng': LNG, 'service': 'nonsense'},
                     headers=owner['headers'])
    assert bad.status_code == 422
    out = client.get('/api/mechanics/nearby', params={'lat': 95, 'lng': LNG}, headers=owner['headers'])
    assert out.status_code == 422
    by_mech = client.get('/api/mechanics/nearby', params={'lat': LAT, 'lng': LNG}, headers=mechanic['headers'])
    assert by_mech.status_code == 403