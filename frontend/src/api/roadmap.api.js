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

  // F2-06 — public, no-auth share links onto the roadmap.
  listShareLinks: (projectId) =>
    apiClient.get(`/projects/${projectId}/roadmap/share-links`).then((r) => r.data),

  createShareLink: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/roadmap/share-links`, body).then((r) => r.data),

  revokeShareLink: (projectId, linkId) =>
    apiClient.delete(`/projects/${projectId}/roadmap/share-links/${linkId}`).then((r) => r.data),
};

// Public share read uses no auth — call axios directly so the auth
// interceptor doesn't hijack the URL or attach a bearer token.
import axios from 'axios';
export const publicShareApi = {
  getRoadmap: (token, password) =>
    axios
      .get(`/api/v1/share/roadmap/${encodeURIComponent(token)}`, {
        params: password ? { password } : undefined,
      })
      .then((r) => r.data),
};
