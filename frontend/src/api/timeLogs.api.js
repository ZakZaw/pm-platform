import { apiClient } from './client';

export const timeLogsApi = {
  list: (taskId) =>
    apiClient.get(`/tasks/${taskId}/time-logs`).then((r) => r.data),

  log: (taskId, body) =>
    apiClient.post(`/tasks/${taskId}/time-logs`, body).then((r) => r.data),

  remove: (timeLogId) =>
    apiClient.delete(`/time-logs/${timeLogId}`).then((r) => r.data),
};
