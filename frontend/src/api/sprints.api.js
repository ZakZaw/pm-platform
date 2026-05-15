import { apiClient } from './client';

export const sprintsApi = {
  listForProject: (projectId) =>
    apiClient.get(`/projects/${projectId}/sprints`).then((r) => r.data),

  getActive: (projectId) =>
    apiClient.get(`/projects/${projectId}/sprints/active`).then((r) => r.data),

  create: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/sprints`, body).then((r) => r.data),

  start: (sprintId) =>
    apiClient.post(`/sprints/${sprintId}/start`).then((r) => r.data),

  close: (sprintId, body = { moveCarryoversToBacklog: true }) =>
    apiClient.post(`/sprints/${sprintId}/close`, body).then((r) => r.data),

  addStory: (sprintId, storyId) =>
    apiClient.post(`/sprints/${sprintId}/stories/${storyId}`).then((r) => r.data),

  removeStory: (storyId) =>
    apiClient.delete(`/sprints/stories/${storyId}`).then((r) => r.data),
};
