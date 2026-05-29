import { apiClient } from './client';

// F2-26 (AN-01..03) — project analytics. All three are read-only and
// recomputed server-side on every call, so the dashboard never has to
// reconcile stale derived numbers.
export const analyticsApi = {
  // Pass sprintId to chart a specific sprint; omit for the active one.
  // Returns { sprintId, sprintName, totalPoints, days, todayIndex, points: [{ dayIndex, date, ideal, remaining }] }.
  // sprintId is null when the project has no resolvable sprint.
  burndown: (projectId, sprintId) =>
    apiClient
      .get(`/projects/${projectId}/analytics/burndown`, {
        params: sprintId ? { sprint_id: sprintId } : undefined,
      })
      .then((r) => r.data),

  // Returns { sprints: [{ sprintId, name, committed, completed, rollingAverage, current }] }, oldest first.
  velocity: (projectId) =>
    apiClient.get(`/projects/${projectId}/analytics/velocity`).then((r) => r.data),

  // Returns { epics: [{ epicId, name, color, donePoints, totalPoints, doneCount, totalCount }] }.
  epicProgress: (projectId) =>
    apiClient.get(`/projects/${projectId}/analytics/epic-progress`).then((r) => r.data),
};
