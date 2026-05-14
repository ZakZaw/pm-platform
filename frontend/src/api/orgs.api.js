import axios from 'axios';
import { apiClient } from './client';
import { useAuthStore } from '@/store/authStore';

export const orgsApi = {
  mine: () => apiClient.get('/users/me/orgs').then((r) => r.data),

  get: (slug) => apiClient.get(`/orgs/${slug}`).then((r) => r.data),

  update: (slug, body) => apiClient.patch(`/orgs/${slug}`, body).then((r) => r.data),

  listMembers: (slug, { page = 1, pageSize = 20, search, role } = {}) => {
    const params = { page, pageSize };
    if (search) params.search = search;
    if (role) params.role = role;
    return apiClient.get(`/orgs/${slug}/members`, { params }).then((r) => r.data);
  },

  updateMemberRole: (slug, userId, role) =>
    apiClient.patch(`/orgs/${slug}/members/${userId}/role`, { role }).then((r) => r.data),

  removeMember: (slug, userId) =>
    apiClient.delete(`/orgs/${slug}/members/${userId}`).then((r) => r.data),

  create: async ({ name, logo }) => {
    const form = new FormData();
    form.append('name', name);
    if (logo) form.append('logo', logo);

    const token = useAuthStore.getState().accessToken;
    const response = await axios.post('/api/v1/orgs', form, {
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
      },
    });
    return response.data;
  },
};
