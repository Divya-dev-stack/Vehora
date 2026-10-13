import pytest
from bson import ObjectId

from app.db.mongo import get_db
from app.ml.train_complaints import METRICS, MODEL

needs_model = pytest.mark.skipif(not MODEL.exists(), reason='Model file is not trained yet')


@needs_model
def test_classify_response_shape(client, owner):
    r = client.post('/api/assistant/classify', headers=owner['headers'],
                    json={'text': 'my battery is dead and the bike will not start'})
    assert r.status_code == 200, r.text
    d = r.json()
    for key in ('category', 'label', 'confidence', 'confident', 'is_vehicle_problem',
                'advice', 'alternatives', 'disclaimer'):
        assert key in d
    assert 0 <= d['confidence'] <= 1
    assert len(d['alternatives']) == 3
    assert 'Estimate only' in d['disclaimer']


@needs_model
@pytest.mark.parametrize('text, expected', [
    ('the front tyre is flat', 'tyres'),
    ('brake pedal feels soft', 'brakes'),
    ('battery is dead', 'battery'),
])
def test_clear_examples_are_classified(client, owner, text, expected):
    r = client.post('/api/assistant/classify', headers=owner['headers'], json={'text': text})
    assert r.status_code == 200
    assert r.json()['category'] == expected


@needs_model
def test_complaint_is_stored_and_counted(client, make, admin):
    u = make('user')
    client.post('/api/assistant/classify', headers=u['headers'], json={'text': 'engine is overheating'})
    stored = get_db().complaints.count_documents({'user_id': ObjectId(u['id'])})
    assert stored == 1
    stats = client.get('/api/admin/stats', headers=admin['headers']).json()
    assert stats['complaints']['total'] >= 1


@pytest.mark.parametrize('text', ['a', '', ' ', 'x' * 501])
def test_bad_complaint_text_is_rejected(client, owner, text):
    r = client.post('/api/assistant/classify', headers=owner['headers'], json={'text': text})
    assert r.status_code == 422


def test_classify_requires_login(client):
    assert client.post('/api/assistant/classify', json={'text': 'engine noise'}).status_code == 401


@pytest.mark.skipif(not METRICS.exists(), reason='Metrics file is missing')
def test_model_info_returns_metrics(client, owner):
    r = client.get('/api/assistant/model-info', headers=owner['headers'])
    assert r.status_code == 200
    assert isinstance(r.json(), dict)