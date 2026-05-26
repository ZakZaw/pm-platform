import { apiClient } from './client';

export const pokerApi = {
  getActive: (taskId) =>
    apiClient.get(`/tasks/${taskId}/poker`).then((r) => r.data),

  start: (taskId) =>
    apiClient.post(`/tasks/${taskId}/poker`).then((r) => r.data),

  vote: (sessionId, value) =>
    apiClient.post(`/poker/${sessionId}/votes`, { value }).then((r) => r.data),

  reveal: (sessionId) =>
    apiClient.post(`/poker/${sessionId}/reveal`).then((r) => r.data),

  close: (sessionId, { finalEstimate, applyToTask } = {}) =>
    apiClient
      .post(`/poker/${sessionId}/close`, { finalEstimate, applyToTask })
      .then((r) => r.data),
};
