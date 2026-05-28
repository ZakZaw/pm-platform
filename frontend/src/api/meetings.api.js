import { apiClient } from './client';

// F2-19 — meetings, RSVP, AI agenda preview.
export const meetingsApi = {
  listForProject: (projectId, { includePast = false, includeCancelled = false } = {}) =>
    apiClient
      .get(`/projects/${projectId}/meetings`, {
        params: { include_past: includePast, include_cancelled: includeCancelled },
      })
      .then((r) => r.data),

  get: (meetingId) =>
    apiClient.get(`/meetings/${meetingId}`).then((r) => r.data),

  create: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/meetings`, body).then((r) => r.data),

  update: (meetingId, body) =>
    apiClient.patch(`/meetings/${meetingId}`, body).then((r) => r.data),

  cancel: (meetingId) =>
    apiClient.delete(`/meetings/${meetingId}`).then(() => undefined),

  rsvp: (meetingId, response) =>
    apiClient.post(`/meetings/${meetingId}/rsvp`, { response }).then((r) => r.data),

  // Preview AI agenda for the create form (no persistence).
  previewAgenda: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/meetings/agenda-preview`, body).then((r) => r.data),
};
