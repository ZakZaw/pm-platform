import { apiClient } from './client';

export const activityApi = {
  // Cursor pagination: pass the previous response's nextCursor as `before`.
  listForProject: (projectId, { limit, before } = {}) =>
    apiClient
      .get(`/projects/${projectId}/activity`, {
        params: {
          ...(limit ? { limit } : {}),
          ...(before ? { before } : {}),
        },
      })
      .then((r) => r.data),
};
