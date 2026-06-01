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

  // F3-16 — composite health. Returns { score, band, signals: [{ label, tone, value }] }.
  health: (projectId) =>
    apiClient.get(`/projects/${projectId}/analytics/health`).then((r) => r.data),

  // Headline KPIs. Returns { openTasks, onTrackPct, bugRatioPct, avgCycleDays };
  // the ratio/duration fields may be null when there's not enough data.
  kpis: (projectId) =>
    apiClient.get(`/projects/${projectId}/analytics/kpis`).then((r) => r.data),

  // F3-14 — team workload. Returns { days: [..], members: [{ userId, name, load: [..] }] }.
  workload: (projectId) =>
    apiClient.get(`/projects/${projectId}/analytics/workload`).then((r) => r.data),

  // F3-18 — computed weekly insight. Returns { headline, detail, tone, highlights: [..] }.
  insight: (projectId) =>
    apiClient.get(`/projects/${projectId}/analytics/insight`).then((r) => r.data),

  // ---- Per-type dashboard analytics (polish D) ----
  // Each returns one server-computed aggregate for that project type's
  // dashboard, replacing the client-side derivations the widgets used to do.

  // Sales: { currency, openPipelineValue, weightedForecast, wonValue, wonCount,
  //   lostCount, winRatePct, funnel: [{ name, count, value, conversionPct }],
  //   dealsAtRisk: [{ id, name, stageName, probability, value, currency, expectedClose }] }.
  sales: (projectId) =>
    apiClient.get(`/projects/${projectId}/analytics/sales`).then((r) => r.data),

  // Support: { openCount, breachedOpenCount, slaAttainmentPct, resolvedCount,
  //   queues: [{ queueId, name, openCount, breachedCount }],
  //   breaches: [{ id, subject, queueName, slaDueAt }] }.
  support: (projectId) =>
    apiClient.get(`/projects/${projectId}/analytics/support`).then((r) => r.data),

  // Marketing: { activeCampaignCount, publishedLast30, throughput: [{ weekStart, count }],
  //   activeCampaigns: [{ id, name, assetCount, publishedAssetCount }],
  //   channelMix: [{ channel, count }], dueThisWeek: [{ id, title, publishDate }] }.
  marketing: (projectId) =>
    apiClient.get(`/projects/${projectId}/analytics/marketing`).then((r) => r.data),

  // Operations: { next7DaysCount, overdueCount, completionPct, onTimePct, skipPct,
  //   windowTotal, upcoming: [{ runId, workflowName, scheduledFor }],
  //   overdue: [{ runId, workflowName, scheduledFor }] }.
  operations: (projectId) =>
    apiClient.get(`/projects/${projectId}/analytics/operations`).then((r) => r.data),
};
