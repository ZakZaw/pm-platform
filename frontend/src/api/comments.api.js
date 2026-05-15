import { apiClient } from './client';

export const commentsApi = {
  listForTask: (taskId) =>
    apiClient.get(`/tasks/${taskId}/comments`).then((r) => r.data),

  create: (taskId, body) =>
    apiClient.post(`/tasks/${taskId}/comments`, body).then((r) => r.data),

  update: (commentId, body) =>
    apiClient.patch(`/comments/${commentId}`, body).then((r) => r.data),

  remove: (commentId) =>
    apiClient.delete(`/comments/${commentId}`).then((r) => r.data),

  mentionableUsers: (projectId, query) =>
    apiClient
      .get(`/projects/${projectId}/mentionable-users`, { params: query ? { q: query } : undefined })
      .then((r) => r.data),
};
