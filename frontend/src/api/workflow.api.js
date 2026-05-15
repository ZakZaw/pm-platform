import { apiClient } from './client';

export const workflowApi = {
  list: (projectId) =>
    apiClient.get(`/projects/${projectId}/status-config`).then((r) => r.data),

  update: (projectId, configId, patch) =>
    apiClient.patch(`/projects/${projectId}/status-config/${configId}`, patch).then((r) => r.data),

  reorder: (projectId, orderedConfigIds) =>
    apiClient
      .post(`/projects/${projectId}/status-config/reorder`, { orderedConfigIds })
      .then((r) => r.data),
};
