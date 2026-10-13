import api from './api';

export const getVehicleMeta = () => api.get('/vehicle-types').then((r) => r.data);
export const listVehicles = () => api.get('/vehicles').then((r) => r.data);
export const getVehicle = (id) => api.get('/vehicles/' + id).then((r) => r.data);
export const createVehicle = (data) => api.post('/vehicles', data).then((r) => r.data);
export const updateVehicle = (id, data) => api.put('/vehicles/' + id, data).then((r) => r.data);
export const deleteVehicle = (id) => api.delete('/vehicles/' + id);
