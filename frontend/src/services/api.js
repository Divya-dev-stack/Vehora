import axios from 'axios';

export const TOKEN_KEY = 'vehora_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = 'Bearer ' + token;
  } catch {
    // storage unavailable, continue without a token
  }
  return config;
});

export function getErrorMessage(err) {
  if (!err.response) {
    return 'Cannot reach the VEHORA server. Please check that the backend is running.';
  }
  const detail = err.response.data?.detail;
  if (typeof detail === 'string') return detail;
  if (err.response.status === 422) return 'Please check the details you entered.';
  return 'Something went wrong. Please try again.';
}

export default api;
