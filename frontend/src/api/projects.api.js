import { apiClient } from './client';

export const projectsApi = {
  listForOrg: (orgSlug) =>
    apiClient.get(`/orgs/${orgSlug}/projects`).then((r) => r.data),

  create: (orgSlug, body) =>
    apiClient.post(`/orgs/${orgSlug}/projects`, body).then((r) => r.data),

  getBySlug: (orgSlug, projectSlug) =>
    apiClient.get(`/orgs/${orgSlug}/projects/${projectSlug}`).then((r) => r.data),

  // F2-08 — PM-only mutator for project settings (currently just aiControlMode).
  updateSettings: (projectId, body) =>
    apiClient.patch(`/projects/${projectId}/settings`, body).then((r) => r.data),

  listMembers: (projectId) =>
    apiClient.get(`/projects/${projectId}/members`).then((r) => r.data),

  addMember: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/members`, body).then((r) => r.data),

  updateMemberRole: (projectId, userId, role) =>
    apiClient.patch(`/projects/${projectId}/members/${userId}`, { role }).then((r) => r.data),

  removeMember: (projectId, userId) =>
    apiClient.delete(`/projects/${projectId}/members/${userId}`).then((r) => r.data),
};
