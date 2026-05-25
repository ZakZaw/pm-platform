import { apiClient } from './client';

export const notificationsApi = {
  // Returns { items, unreadTotal, nextCursor }. Set unreadOnly to filter.
  listMine: ({ limit, before, unreadOnly } = {}) =>
    apiClient
      .get('/users/me/notifications', {
        params: {
          ...(limit ? { limit } : {}),
          ...(before ? { before } : {}),
          ...(unreadOnly ? { unread_only: true } : {}),
        },
      })
      .then((r) => r.data),

  markRead: (id) =>
    apiClient.post(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    apiClient.post('/notifications/read-all').then((r) => r.data),
};
