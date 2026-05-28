import { apiClient } from './client';

// F2-16 channels + F2-17 DMs + F2-18 messages.
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

  // F2-17 — create or look up a DM. Posting the same member set twice
  // returns the existing channel rather than creating a duplicate.
  createDm: (orgSlug, { memberIds }) =>
    apiClient
      .post(`/orgs/${orgSlug}/dms`, { memberIds })
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

  // F2-18 messages, threads, reactions.
  listMessages: (channelId, { before = null, limit = 50 } = {}) =>
    apiClient
      .get(`/channels/${channelId}/messages`, {
        params: { before: before ?? undefined, limit },
      })
      .then((r) => r.data),

  postMessage: (channelId, { bodyMd, parentMessageId = null }) =>
    apiClient
      .post(`/channels/${channelId}/messages`, { bodyMd, parentMessageId })
      .then((r) => r.data),

  editMessage: (messageId, { bodyMd }) =>
    apiClient.patch(`/messages/${messageId}`, { bodyMd }).then((r) => r.data),

  deleteMessage: (messageId) =>
    apiClient.delete(`/messages/${messageId}`).then(() => undefined),

  toggleReaction: (messageId, { emoji }) =>
    apiClient
      .post(`/messages/${messageId}/reactions`, { emoji })
      .then((r) => r.data),

  getThread: (parentMessageId) =>
    apiClient.get(`/messages/${parentMessageId}/thread`).then((r) => r.data),
};
