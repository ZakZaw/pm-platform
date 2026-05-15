import { apiClient } from './client';

export const subtasksApi = {
  listForTask: (taskId) =>
    apiClient.get(`/tasks/${taskId}/subtasks`).then((r) => r.data),

  create: (taskId, body) =>
    apiClient.post(`/tasks/${taskId}/subtasks`, body).then((r) => r.data),

  update: (subtaskId, body) =>
    apiClient.patch(`/subtasks/${subtaskId}`, body).then((r) => r.data),

  remove: (subtaskId) =>
    apiClient.delete(`/subtasks/${subtaskId}`).then((r) => r.data),
};
