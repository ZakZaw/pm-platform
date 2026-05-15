import { apiClient } from './client';

export const storiesApi = {
  listForProject: (projectId, { epicId } = {}) =>
    apiClient
      .get(`/projects/${projectId}/stories`, { params: epicId ? { epicId } : undefined })
      .then((r) => r.data),

  get: (storyId) => apiClient.get(`/stories/${storyId}`).then((r) => r.data),

  create: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/stories`, body).then((r) => r.data),

  update: (storyId, body) =>
    apiClient.patch(`/stories/${storyId}`, body).then((r) => r.data),

  remove: (storyId) => apiClient.delete(`/stories/${storyId}`).then((r) => r.data),

  changeStatus: (storyId, { to }) =>
    apiClient.patch(`/stories/${storyId}/status`, { to }).then((r) => r.data),
};
