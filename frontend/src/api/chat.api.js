import { apiClient } from './client';

// F2-16 — channel scaffolding. Message posting lands in F2-18.
export const chatApi = {
  listChannels: (orgSlug, { includeArchived = false } = {}) =>
    apiClient
      .get(`/orgs/${orgSlug}/channels`, { params: { include_archived: includeArchived } })
      .then((r) => r.data),

  getChannel: (channelId) =>
    apiClient.get(`/channels/${channelId}`).then((r) => r.data),

  createTopicChannel: (orgSlug, { name, epicId = null, memberIds = null }) =>
    apiClient
      .post(`/orgs/${orgSlug}/channels`, { name, epicId, memberIds })
      .then((r) => r.data),

  addMember: (channelId, userId) =>
    apiClient
      .post(`/channels/${channelId}/members`, { userId })
      .then((r) => r.data),

  removeMember: (channelId, userId) =>
    apiClient.delete(`/channels/${channelId}/members/${userId}`).then(() => undefined),

  markRead: (channelId) =>
    apiClient.post(`/channels/${channelId}/read`).then(() => undefined),

  archive: (channelId) =>
    apiClient.post(`/channels/${channelId}/archive`).then(() => undefined),
};
