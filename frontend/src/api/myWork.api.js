import { apiClient } from './client';

export const myWorkApi = {
  list: ({ filter, projectId, sprintId } = {}) => {
    const params = {};
    if (filter) params.filter = filter;
    if (projectId) params.project_id = projectId;
    if (sprintId) params.sprint_id = sprintId;
    return apiClient.get('/users/me/tasks', { params }).then((r) => r.data);
  },
};
