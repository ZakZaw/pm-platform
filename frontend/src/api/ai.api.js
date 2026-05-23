import { apiClient } from './client';

export const aiApi = {
  clarify: ({ description, type }) =>
    apiClient
      .post('/ai/clarify', { description, type })
      .then((r) => r.data),

  generateProject: (orgSlug, { description, type, clarifications }) =>
    apiClient
      .post(`/orgs/${orgSlug}/ai/generate-project`, {
        description,
        type,
        clarifications,
      })
      .then((r) => r.data),

  applyGeneratedProject: (requestId, { projectName, type, epics }) =>
    apiClient
      .post(`/ai/generate-project/${requestId}/apply`, {
        projectName,
        type,
        epics,
      })
      .then((r) => r.data),

  // F1.5-07 — non-Engineering apply. The server already has the typed
  // draft canonical in PreviewJson, so we just commit it under a name.
  applyTypedGeneratedProject: (requestId, projectName) =>
    apiClient
      .post(`/ai/generate-typed-project/${requestId}/apply`, { projectName })
      .then((r) => r.data),

  estimateTask: (taskId) =>
    apiClient.post(`/tasks/${taskId}/estimate`).then((r) => r.data),

  aiFillSprint: (sprintId, target) =>
    apiClient
      .post(`/sprints/${sprintId}/ai-fill`, null, { params: target ? { target } : undefined })
      .then((r) => r.data),

  generateEpic: (projectId, { description }) =>
    apiClient
      .post(`/projects/${projectId}/ai/generate-epic`, { description })
      .then((r) => r.data),

  applyEpic: (projectId, epic) =>
    apiClient
      .post(`/projects/${projectId}/ai/apply-epic`, { epic })
      .then((r) => r.data),

  generateTasks: (projectId, { description, epicId = null, maxTasks = null }) =>
    apiClient
      .post(`/projects/${projectId}/ai/generate-tasks`, {
        description,
        epicId,
        maxTasks,
      })
      .then((r) => r.data),

  applyTasks: (projectId, { epicId = null, tasks }) =>
    apiClient
      .post(`/projects/${projectId}/ai/apply-tasks`, { epicId, tasks })
      .then((r) => r.data),

  breakdownTask: (taskId) =>
    apiClient.post(`/tasks/${taskId}/ai/breakdown`).then((r) => r.data),

  listSuggestions: (projectId, { includeActed = false } = {}) =>
    apiClient
      .get(`/projects/${projectId}/ai/suggestions`, { params: { includeActed } })
      .then((r) => r.data),

  generateSprintHealth: (projectId) =>
    apiClient
      .post(`/projects/${projectId}/ai/suggestions/sprint-health`)
      .then((r) => r.data),

  dismissSuggestion: (id) =>
    apiClient.post(`/ai/suggestions/${id}/dismiss`).then((r) => r.data),

  acceptSuggestion: (id) =>
    apiClient.post(`/ai/suggestions/${id}/accept`).then((r) => r.data),
};
