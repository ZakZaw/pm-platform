import { apiClient } from './client';

export const aiApi = {
  clarify: ({ description, environmentType }) =>
    apiClient
      .post('/ai/clarify', { description, environmentType })
      .then((r) => r.data),

  generateProject: (orgSlug, { description, environmentType, clarifications }) =>
    apiClient
      .post(`/orgs/${orgSlug}/ai/generate-project`, {
        description,
        environmentType,
        clarifications,
      })
      .then((r) => r.data),

  applyGeneratedProject: (requestId, { projectName, environmentType, epics }) =>
    apiClient
      .post(`/ai/generate-project/${requestId}/apply`, {
        projectName,
        environmentType,
        epics,
      })
      .then((r) => r.data),

  estimateStory: (storyId) =>
    apiClient.post(`/stories/${storyId}/estimate`).then((r) => r.data),

  aiFillSprint: (sprintId, target) =>
    apiClient
      .post(`/sprints/${sprintId}/ai-fill`, null, { params: target ? { target } : undefined })
      .then((r) => r.data),
};
