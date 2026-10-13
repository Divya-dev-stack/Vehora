import api from './api';

export const getMechanicMeta = () => api.get('/mechanics/meta').then((r) => r.data);

export const getMyProfile = async () => {
  try {
    const res = await api.get('/mechanics/me');
    return res.data;
  } catch (err) {
    if (err.response && err.response.status === 404) return null;
    throw err;
  }
};

export const saveMyProfile = (data) => api.put('/mechanics/me', data).then((r) => r.data);
