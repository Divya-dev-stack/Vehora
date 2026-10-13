import api from './api';

export const getAssessment = (vehicleId) =>
  api.get('/assessment/' + vehicleId).then((r) => r.data);
