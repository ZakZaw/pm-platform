import { apiClient } from './client';

export const dashboardApi = {
  // Returns { projectId, layoutJson, updatedAt }; layoutJson is null when
  // the user has never saved a layout for this project.
  getLayout: (projectId) =>
    apiClient.get(`/projects/${projectId}/dashboard/layout`).then((r) => r.data),

  saveLayout: (projectId, layout) =>
    apiClient
      .put(`/projects/${projectId}/dashboard/layout`, { layoutJson: JSON.stringify(layout) })
      .then((r) => r.data),
};
