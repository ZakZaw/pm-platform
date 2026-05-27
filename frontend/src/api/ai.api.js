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

  // F2-14 — same AI pass as generateEpic plus a timeline-impact
  // projection (which sprints overflow, which milestones shift).
  breakdownFeature: (projectId, { description }) =>
    apiClient
      .post(`/projects/${projectId}/ai/breakdown`, { description })
      .then((r) => r.data),

  // F2-14 — applyEpic now accepts an optional targetSprintId. Null
  // means "Add to backlog" (default); non-null means "Add to sprint X"
  // and the new tasks land in that sprint as ToDo.
  applyEpic: (projectId, epic, { targetSprintId = null } = {}) =>
    apiClient
      .post(`/projects/${projectId}/ai/apply-epic`,
        { epic, targetSprintId })
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

  // F2-12 — manual trigger for the daily replan scanner. Force-generates
  // regardless of the projection threshold so a PM can preview the card.
  generateVelocityReplan: (sprintId) =>
    apiClient
      .post(`/sprints/${sprintId}/ai/replan`)
      .then((r) => r.data),

  // F2-12 — apply one of the three options. `option` is the case-insensitive
  // string name: "CutScope" | "AddResource" | "ShiftMilestone".
  applyVelocityReplan: (suggestionId, option) =>
    apiClient
      .post(`/ai/suggestions/${suggestionId}/apply-replan`, { option })
      .then((r) => r.data),

  // F2-13 — manual trigger to preview the reassignment card for a
  // teammate. orgId scopes the walk to a single org when supplied.
  generateReassignmentSuggestion: (userId, { orgId } = {}) =>
    apiClient
      .post(`/users/${userId}/ai/reassignment`, null,
        { params: orgId ? { org_id: orgId } : undefined })
      .then((r) => r.data),

  // F2-13 — bulk-accept (omit picks) or override per task. Picks is
  // an array of { taskId, newAssigneeId } overriding the default top
  // candidate for that task.
  applyReassignments: (suggestionId, picks) =>
    apiClient
      .post(`/ai/suggestions/${suggestionId}/apply-reassignments`,
        { picks: picks ?? null })
      .then((r) => r.data),
};
