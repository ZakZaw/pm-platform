import { apiClient } from './client';

export const epicsApi = {
  listForProject: (projectId, { includeArchived = false } = {}) =>
    apiClient
      .get(`/projects/${projectId}/epics`, { params: { includeArchived } })
      .then((r) => r.data),

  create: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/epics`, body).then((r) => r.data),

  update: (epicId, body) =>
    apiClient.patch(`/epics/${epicId}`, body).then((r) => r.data),

  archive: (epicId) =>
    apiClient
      .patch(`/epics/${epicId}`, { status: 'Archived' })
      .then((r) => r.data),

  get: (epicId) => apiClient.get(`/epics/${epicId}`).then((r) => r.data),
};
