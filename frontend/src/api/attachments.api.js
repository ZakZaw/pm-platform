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

  // Attachments are private: fetch through the authorized endpoint (the
  // bearer token rides on the axios request) and hand the blob to the
  // browser. There is no public URL to link to.
  download: (attachmentId) =>
    apiClient
      .get(`/attachments/${attachmentId}/download`, { responseType: 'blob' })
      .then((r) => r.data),

  remove: (attachmentId) =>
    apiClient.delete(`/attachments/${attachmentId}`).then((r) => r.data),
};
