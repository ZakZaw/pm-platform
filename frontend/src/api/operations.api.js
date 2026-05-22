import { apiClient } from './client';

// Workflow recurrence rules use a tiny RRULE subset:
//   FREQ=DAILY|WEEKLY|MONTHLY (optionally with ;INTERVAL=N)
// See RecurrenceRuleHelper.cs on the backend.
export const operationsApi = {
  // Workflows ----------
  listWorkflows: (projectId, { includeArchived = false } = {}) =>
    apiClient
      .get(`/projects/${projectId}/workflows`, { params: { includeArchived } })
      .then((r) => r.data),

  getWorkflow: (workflowId) =>
    apiClient.get(`/workflows/${workflowId}`).then((r) => r.data),

  createWorkflow: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/workflows`, body).then((r) => r.data),

  updateWorkflow: (workflowId, body) =>
    apiClient.patch(`/workflows/${workflowId}`, body).then((r) => r.data),

  deleteWorkflow: (workflowId) =>
    apiClient.delete(`/workflows/${workflowId}`).then((r) => r.data),

  // Runs ----------
  getRun: (runId) =>
    apiClient.get(`/runs/${runId}`).then((r) => r.data),

  startRun: (runId) =>
    apiClient.post(`/runs/${runId}/start`).then((r) => r.data),

  skipRun: (runId, reason) =>
    apiClient.post(`/runs/${runId}/skip`, { reason }).then((r) => r.data),

  // Checklist items ----------
  toggleItem: (itemId, completed) =>
    apiClient
      .post(`/checklist-items/${itemId}/toggle`, { completed })
      .then((r) => r.data),

  // MyWork integration ----------
  myRuns: ({ windowDays = 7 } = {}) =>
    apiClient
      .get('/users/me/operations-runs', { params: { window_days: windowDays } })
      .then((r) => r.data),
};

export const RECURRENCE_PRESETS = [
  { rule: '', label: 'No recurrence' },
  { rule: 'FREQ=DAILY', label: 'Every day' },
  { rule: 'FREQ=WEEKLY', label: 'Every week' },
  { rule: 'FREQ=WEEKLY;INTERVAL=2', label: 'Every 2 weeks' },
  { rule: 'FREQ=MONTHLY', label: 'Every month' },
  { rule: 'FREQ=MONTHLY;INTERVAL=3', label: 'Every quarter' },
];

export function describeRecurrence(rule) {
  const preset = RECURRENCE_PRESETS.find((p) => p.rule === (rule ?? ''));
  if (preset) return preset.label;
  return rule || 'No recurrence';
}
