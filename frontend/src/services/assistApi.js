import api from './api';

const data = (r) => r.data;

export const findNearbyMechanics = (params) => api.get('/mechanics/nearby', { params }).then(data);

export const getMyLocation = () => api.get('/mechanics/me/location').then(data);
export const saveMyLocation = (body) => api.put('/mechanics/me/location', body).then(data);
export const removeMyLocation = () => api.delete('/mechanics/me/location').then(data);

export const createAssistance = (body) => api.post('/assistance', body).then(data);
export const listMyAssistance = () => api.get('/assistance/mine').then(data);
export const cancelAssistance = (id) => api.post('/assistance/' + id + '/cancel').then(data);

export const listOpenRequests = () => api.get('/assistance/open').then(data);
export const listMyJobs = () => api.get('/assistance/jobs').then(data);
export const acceptRequest = (id) => api.post('/assistance/' + id + '/accept').then(data);
export const completeRequest = (id) => api.post('/assistance/' + id + '/complete').then(data);
export const releaseRequest = (id) => api.post('/assistance/' + id + '/release').then(data);