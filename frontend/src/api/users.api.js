import axios from 'axios';
import { apiClient } from './client';
import { useAuthStore } from '@/store/authStore';

export const usersApi = {
  me: () => apiClient.get('/users/me').then((r) => r.data),

  updateProfile: (body) => apiClient.patch('/users/me', body).then((r) => r.data),

  uploadAvatar: async (file) => {
    const form = new FormData();
    form.append('avatar', file);

    // Same shape as orgs.create — bare axios so Content-Type stays
    // multipart/form-data and the bearer is still attached.
    const token = useAuthStore.getState().accessToken;
    const response = await axios.post('/api/v1/users/me/avatar', form, {
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
      },
    });
    return response.data;
  },

  deleteAvatar: () => apiClient.delete('/users/me/avatar').then((r) => r.data),

  personalProject: () =>
    apiClient.get('/users/me/personal-project').then((r) => r.data),

  myWork: (params) =>
    apiClient.get('/users/me/tasks', { params }).then((r) => r.data),
};
