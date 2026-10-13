import api from './api';

const data = (r) => r.data;

export const listServiceRecords = (vehicleId) =>
  api.get('/service-records', { params: vehicleId ? { vehicle_id: vehicleId } : {} }).then(data);
export const createServiceRecord = (body) => api.post('/service-records', body).then(data);
export const deleteServiceRecord = (id) => api.delete('/service-records/' + id).then(data);

export const listReminders = (includeDone = false) =>
  api.get('/reminders', { params: { include_done: includeDone } }).then(data);
export const createReminder = (body) => api.post('/reminders', body).then(data);
export const completeReminder = (id) => api.post('/reminders/' + id + '/done').then(data);
export const deleteReminder = (id) => api.delete('/reminders/' + id).then(data);