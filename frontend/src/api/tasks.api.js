import { apiClient } from './client';

export const tasksApi = {
  listForStory: (storyId) =>
    apiClient.get(`/stories/${storyId}/tasks`).then((r) => r.data),

  get: (taskId) => apiClient.get(`/tasks/${taskId}`).then((r) => r.data),

  create: (storyId, body) =>
    apiClient.post(`/stories/${storyId}/tasks`, body).then((r) => r.data),

  update: (taskId, body) =>
    apiClient.patch(`/tasks/${taskId}`, body).then((r) => r.data),

  remove: (taskId) => apiClient.delete(`/tasks/${taskId}`).then((r) => r.data),

  changeStatus: (taskId, { to, reason }) =>
    apiClient.patch(`/tasks/${taskId}/status`, { to, reason }).then((r) => r.data),
};
