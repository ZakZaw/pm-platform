import axios from 'axios';
import { apiClient } from './client';

export const authApi = {
  register: (body) => apiClient.post('/auth/register', body).then((r) => r.data),
  login: (body) => apiClient.post('/auth/login', body).then((r) => r.data),
  me: () => apiClient.get('/users/me').then((r) => r.data),
};

export async function rawRefresh(refreshToken) {
  const response = await axios.post(
    '/api/v1/auth/refresh',
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  );
  return response.data;
}
