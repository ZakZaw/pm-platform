import { apiClient } from './client';

export const boardApi = {
  get: (projectId, { sprintId, swimlaneBy } = {}) => {
    const params = {};
    if (sprintId) params.sprint_id = sprintId;
    if (swimlaneBy) params.swimlane_by = swimlaneBy;
    return apiClient.get(`/projects/${projectId}/board`, { params }).then((r) => r.data);
  },

  backlog: (projectId) =>
    apiClient.get(`/projects/${projectId}/backlog`).then((r) => r.data),

  reorderBacklog: (projectId, storyIds) =>
    apiClient.post(`/projects/${projectId}/backlog/reorder`, { storyIds }).then((r) => r.data),
};
