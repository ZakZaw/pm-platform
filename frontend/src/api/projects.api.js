import { apiClient } from './client';

export const projectsApi = {
  listForOrg: (orgSlug) =>
    apiClient.get(`/orgs/${orgSlug}/projects`).then((r) => r.data),

  create: (orgSlug, body) =>
    apiClient.post(`/orgs/${orgSlug}/projects`, body).then((r) => r.data),

  getBySlug: (orgSlug, projectSlug) =>
    apiClient.get(`/orgs/${orgSlug}/projects/${projectSlug}`).then((r) => r.data),
};
