import api from './api';

export const classifyComplaint = (text) =>
  api.post('/assistant/classify', { text }).then((r) => r.data);
