import { apiClient } from './client';

export const listsApi = {
  // Returns the full Lists page payload — every list with its tasks, plus
  // the "Unsorted" bucket for tasks that aren't in any list.
  getView: (projectId) =>
    apiClient.get(`/projects/${projectId}/lists-view`).then((r) => r.data),

  createList: (projectId, name) =>
    apiClient.post(`/projects/${projectId}/lists`, { name }).then((r) => r.data),

  updateList: (listId, body) =>
    apiClient.patch(`/lists/${listId}`, body).then((r) => r.data),

  deleteList: (listId) =>
    apiClient.delete(`/lists/${listId}`).then((r) => r.data),

  reorder: (projectId, orderedListIds) =>
    apiClient
      .post(`/projects/${projectId}/lists/reorder`, { orderedListIds })
      .then((r) => r.data),

  // listId = null moves the task to Unsorted.
  moveTaskToList: (taskId, listId) =>
    apiClient
      .post(`/tasks/${taskId}/move-to-list`, { listId })
      .then((r) => r.data),
};
