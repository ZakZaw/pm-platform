import { apiClient } from './client';

/**
 * F2-23 — GitHub source-control integration. Connect/disconnect are
 * PM-only on the backend; the OAuth dance is a full-page redirect, so
 * `authorize` hands back a URL the caller navigates to.
 */
export const integrationsApi = {
  list: (projectId) =>
    apiClient.get(`/projects/${projectId}/integrations`).then((r) => r.data),

  /**
   * Ask the backend for the GitHub consent URL for `repo` ("owner/repo").
   * `returnPath` is the relative app path the OAuth callback bounces the
   * browser back to once the repo is linked.
   */
  authorizeGitHub: (projectId, repo, returnPath) =>
    apiClient
      .get(`/projects/${projectId}/integrations/github/authorize`, {
        params: { repo, return_path: returnPath },
      })
      .then((r) => r.data),

  disconnect: (integrationId) =>
    apiClient.delete(`/integrations/${integrationId}`).then((r) => r.data),
};
