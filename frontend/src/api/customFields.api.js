import { apiClient } from './client';

export const customFieldsApi = {
  // Schema (definitions) — project-scoped.
  list: (projectId) =>
    apiClient.get(`/projects/${projectId}/custom-fields`).then((r) => r.data),

  create: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/custom-fields`, body).then((r) => r.data),

  update: (projectId, fieldId, body) =>
    apiClient.patch(`/projects/${projectId}/custom-fields/${fieldId}`, body).then((r) => r.data),

  remove: (projectId, fieldId) =>
    apiClient.delete(`/projects/${projectId}/custom-fields/${fieldId}`).then((r) => r.data),

  // Per-task values.
  getValues: (taskId) =>
    apiClient.get(`/tasks/${taskId}/custom-fields`).then((r) => r.data),

  // body.values = [{ definitionId, value }]. Pass null/undefined value to
  // clear the field for that task.
  setValues: (taskId, values) =>
    apiClient.put(`/tasks/${taskId}/custom-fields`, { values }).then((r) => r.data),
};
