import api from './api';

export const getStats = () => api.get('/admin/stats').then((r) => r.data);
export const listMechanics = () => api.get('/admin/mechanics').then((r) => r.data);
export const listUsers = () => api.get('/admin/users').then((r) => r.data);
export const listRequests = () => api.get('/admin/requests').then((r) => r.data);

export const setMechanicVerified = (id, verified) =>
  api.post('/admin/mechanics/' + id + (verified ? '/verify' : '/unverify')).then((r) => r.data);

export const setUserActive = (id, active) =>
  api.post('/admin/users/' + id + (active ? '/activate' : '/deactivate')).then((r) => r.data);
