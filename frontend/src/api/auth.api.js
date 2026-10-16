import axios from 'axios';
import { apiClient } from './client';

export const authApi = {
  register: (body) => apiClient.post('/auth/register', body).then((r) => r.data),
  login: (body) => apiClient.post('/auth/login', body).then((r) => r.data),
  me: () => apiClient.get('/users/me').then((r) => r.data),
};

/**
 * Server-side sign-out: revokes the refresh token's whole session family.
 * Uses raw axios (not apiClient) so a 401 here can't re-enter the
 * refresh/logout interceptor. Best effort; failures are swallowed because
 * the local session is cleared regardless.
 *
 * @param {string} refreshToken
 * @returns {Promise<void>}
 */
export async function rawLogout(refreshToken) {
  try {
    await axios.post(
      '/api/v1/auth/logout',
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch {
    // Offline or already revoked: nothing more to do.
  }
}

export async function rawRefresh(refreshToken) {
  const response = await axios.post(
    '/api/v1/auth/refresh',
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  );
  return response.data;
}
