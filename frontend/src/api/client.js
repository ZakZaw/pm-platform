import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshInFlight = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status !== 401 || original?._retried || original?.url?.includes('/auth/')) {
      return Promise.reject(error);
    }

    const store = useAuthStore.getState();
    if (!store.refreshToken) {
      store.logout();
      return Promise.reject(error);
    }

    try {
      refreshInFlight = refreshInFlight ?? store.refresh();
      await refreshInFlight;
    } catch (refreshErr) {
      useAuthStore.getState().logout();
      return Promise.reject(refreshErr);
    } finally {
      refreshInFlight = null;
    }

    original._retried = true;
    original.headers.Authorization = `Bearer ${useAuthStore.getState().accessToken}`;
    return apiClient(original);
  },
);
