import { apiClient } from './client';

export const attachmentsApi = {
  list: (taskId) =>
    apiClient.get(`/tasks/${taskId}/attachments`).then((r) => r.data),

  // Multipart form upload — let axios set the boundary.
  upload: (taskId, file, onProgress) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return apiClient
      .post(`/tasks/${taskId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: onProgress,
      })
      .then((r) => r.data);
  },

  remove: (attachmentId) =>
    apiClient.delete(`/attachments/${attachmentId}`).then((r) => r.data),
};
