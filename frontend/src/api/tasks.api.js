import { apiClient } from './client';

export const tasksApi = {
  listForProject: (projectId, params) =>
    apiClient.get(`/projects/${projectId}/tasks`, { params }).then((r) => r.data),

  get: (taskId) => apiClient.get(`/tasks/${taskId}`).then((r) => r.data),

  create: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/tasks`, body).then((r) => r.data),

  update: (taskId, body) =>
    apiClient.patch(`/tasks/${taskId}`, body).then((r) => r.data),

  remove: (taskId) => apiClient.delete(`/tasks/${taskId}`).then((r) => r.data),

  changeStatus: (taskId, { to, reason }) =>
    apiClient.patch(`/tasks/${taskId}/status`, { to, reason }).then((r) => r.data),

  // F2-02 — body: { taskIds, operation: 'status'|'assignee'|'delete', payload }
  // Returns { succeeded: [taskIds], failed: [{ taskId, code, message }] } so the
  // spreadsheet can flag failed rows inline.
  bulk: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/tasks/bulk`, body).then((r) => r.data),

  // F2-09 task dependencies.
  // Returns { dependsOn: [...], blocking: [...] } — each entry has
  // { id, taskId, key, title, status }.
  listDependencies: (taskId) =>
    apiClient.get(`/tasks/${taskId}/dependencies`).then((r) => r.data),

  addDependency: (taskId, dependsOnTaskId) =>
    apiClient
      .post(`/tasks/${taskId}/dependencies`, { dependsOnTaskId })
      .then((r) => r.data),

  removeDependency: (taskId, prereqId) =>
    apiClient.delete(`/tasks/${taskId}/dependencies/${prereqId}`).then((r) => r.data),
};
