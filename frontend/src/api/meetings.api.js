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

  // F2-20 video.
  join: (meetingId) =>
    apiClient.post(`/meetings/${meetingId}/join`).then((r) => r.data),

  listGuestLinks: (meetingId) =>
    apiClient.get(`/meetings/${meetingId}/guest-links`).then((r) => r.data),

  createGuestLink: (meetingId, { guestLabel = null, hoursValid = null } = {}) =>
    apiClient
      .post(`/meetings/${meetingId}/guest-links`, { guestLabel, hoursValid })
      .then((r) => r.data),

  revokeGuestLink: (guestLinkId) =>
    apiClient.delete(`/meetings/guest-links/${guestLinkId}`).then(() => undefined),

  // Anonymous: token is the credential.
  joinAsGuest: (token, displayName = null) =>
    apiClient
      .post(`/meetings/guest/${token}/join`, { displayName })
      .then((r) => r.data),

  // F2-21 transcript.
  getTranscript: (meetingId) =>
    apiClient.get(`/meetings/${meetingId}/transcript`).then((r) => r.data),

  postTranscriptSegment: (meetingId, { text, startedAt, endedAt }) =>
    apiClient
      .post(`/meetings/${meetingId}/transcript/segments`, {
        text, startedAt, endedAt,
      })
      .then((r) => r.data),

  /** Returns a Blob the caller can pipe into a download link. */
  downloadTranscript: (meetingId, format = 'txt') =>
    apiClient
      .get(`/meetings/${meetingId}/transcript/download`, {
        params: { format },
        responseType: 'blob',
      })
      .then((r) => ({ blob: r.data, headers: r.headers })),
};
