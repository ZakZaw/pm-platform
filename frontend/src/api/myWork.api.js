import { apiClient } from './client';

export const myWorkApi = {
  list: ({ filter } = {}) => {
    const params = filter ? { filter } : undefined;
    return apiClient.get('/users/me/tasks', { params }).then((r) => r.data);
  },
};
