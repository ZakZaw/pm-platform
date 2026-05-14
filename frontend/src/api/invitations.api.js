import { apiClient } from './client';

export const invitationsApi = {
  // Admin+ creates an invitation. Body: { email, role }.
  create: (slug, body) =>
    apiClient.post(`/orgs/${slug}/invitations`, body).then((r) => r.data),

  // Public preview (no auth required). Returns enough context to render
  // AcceptInvitePage. Token is never echoed back.
  preview: (token) => apiClient.get(`/invitations/${token}`).then((r) => r.data),

  // Accept an invitation. Requires the caller to be authenticated; the
  // backend enforces that the authenticated user's email matches the
  // invitation email.
  accept: (token) =>
    apiClient.post(`/invitations/${token}/accept`).then((r) => r.data),
};
