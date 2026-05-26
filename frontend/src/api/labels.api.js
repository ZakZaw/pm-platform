import { apiClient } from './client';

export const labelsApi = {
  listForProject: (projectId) =>
    apiClient.get(`/projects/${projectId}/labels`).then((r) => r.data),

  create: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/labels`, body).then((r) => r.data),

  update: (labelId, body) =>
    apiClient.patch(`/labels/${labelId}`, body).then((r) => r.data),

  remove: (labelId) =>
    apiClient.delete(`/labels/${labelId}`).then((r) => r.data),

  listForTask: (taskId) =>
    apiClient.get(`/tasks/${taskId}/labels`).then((r) => r.data),

  setForTask: (taskId, labelIds) =>
    apiClient.put(`/tasks/${taskId}/labels`, { labelIds }).then((r) => r.data),
};
