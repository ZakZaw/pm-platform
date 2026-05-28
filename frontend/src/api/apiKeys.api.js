import { apiClient } from './client';

/**
 * F2-24 — public REST API keys (org Owner/Admin only). Creating a key
 * returns the full secret exactly once, in `{ key, secret }`.
 */
export const apiKeysApi = {
  list: (orgSlug) =>
    apiClient.get(`/orgs/${orgSlug}/api-keys`).then((r) => r.data),

  create: (orgSlug, body) =>
    apiClient.post(`/orgs/${orgSlug}/api-keys`, body).then((r) => r.data),

  revoke: (keyId) =>
    apiClient.delete(`/api-keys/${keyId}`).then((r) => r.data),
};
