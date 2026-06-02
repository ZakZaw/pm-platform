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

  // Start an instant meeting: created InProgress, anchored to "now",
  // never recurring. Server ignores any scheduledAt/recurrence we pass.
  startInstant: (projectId, { title, type = 'Other', durationMinutes = 30, attendees = [] }) =>
    apiClient
      .post(`/projects/${projectId}/meetings`, {
        title,
        type,
        durationMinutes,
        attendees,
        isInstant: true,
      })
      .then((r) => r.data),

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

  // F2-22 post-meeting AI processing.
  finalise: (meetingId) =>
    apiClient.post(`/meetings/${meetingId}/finalise`).then((r) => r.data),

  process: (meetingId) =>
    apiClient.post(`/meetings/${meetingId}/process`).then((r) => r.data),

  getSummary: (meetingId) =>
    apiClient.get(`/meetings/${meetingId}/summary`).then((r) => r.data),

  listActionItems: (meetingId) =>
    apiClient.get(`/meetings/${meetingId}/action-items`).then((r) => r.data),

  acceptActionItem: (actionItemId, body) =>
    apiClient.post(`/action-items/${actionItemId}/accept`, body ?? {}).then((r) => r.data),

  bulkAcceptActionItems: (meetingId, actionItemIds) =>
    apiClient
      .post(`/meetings/${meetingId}/action-items/bulk-accept`, { actionItemIds })
      .then((r) => r.data),

  dismissActionItem: (actionItemId) =>
    apiClient.post(`/action-items/${actionItemId}/dismiss`).then((r) => r.data),
};
