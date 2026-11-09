import { apiClient } from './client';

export const roadmapApi = {
  get: (projectId) =>
    apiClient.get(`/projects/${projectId}/roadmap`).then((r) => r.data),

  // F1.5-08 — type-aware timeline aggregate, shaped by the project's type.
  // Returns { projectId, type, from, to,
  //   groups:  [{ id, label, sublabel }],
  //   bars:    [{ id, label, start, end, tone, sublabel, groupId, flagged }],
  //   markers: [{ id, label, at, tone, kind, sublabel, groupId, flagged }],
  //   stats:   [{ label, value, tone }], undated: [{ id, label }], emptyHint }.
  timeline: (projectId) =>
    apiClient.get(`/projects/${projectId}/roadmap/timeline`).then((r) => r.data),

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
//
// The password is POSTed in the body, never put in the query string,
// where it would leak into server/proxy logs and browser history.
export const publicShareApi = {
  getRoadmap: (token, password) => {
    const url = `/api/v1/share/roadmap/${encodeURIComponent(token)}`;
    const request = password ? axios.post(url, { password }) : axios.get(url);
    return request.then((r) => r.data);
  },
};
