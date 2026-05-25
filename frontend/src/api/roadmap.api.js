import { apiClient } from './client';

export const roadmapApi = {
  get: (projectId) =>
    apiClient.get(`/projects/${projectId}/roadmap`).then((r) => r.data),

  // F2-01 — body: { startDate, endDate, cascade }
  // Server returns { applied, affected: [{ epicId, title, newStartDate, newEndDate }] }.
  // When applied === false the caller should open the cascade-confirm modal
  // and retry with cascade=true.
  updateEpicDates: (projectId, epicId, body) =>
    apiClient
      .patch(`/projects/${projectId}/epics/${epicId}/dates`, body)
      .then((r) => r.data),

  createMilestone: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/milestones`, body).then((r) => r.data),

  updateMilestone: (projectId, milestoneId, body) =>
    apiClient
      .patch(`/projects/${projectId}/milestones/${milestoneId}`, body)
      .then((r) => r.data),

  deleteMilestone: (projectId, milestoneId) =>
    apiClient
      .delete(`/projects/${projectId}/milestones/${milestoneId}`)
      .then((r) => r.data),

  addDependency: (projectId, epicId, dependsOnEpicId) =>
    apiClient
      .post(`/projects/${projectId}/epics/${epicId}/dependencies`, { dependsOnEpicId })
      .then((r) => r.data),

  removeDependency: (projectId, epicId, prereqId) =>
    apiClient
      .delete(`/projects/${projectId}/epics/${epicId}/dependencies/${prereqId}`)
      .then((r) => r.data),
};
