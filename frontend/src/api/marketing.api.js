import { apiClient } from './client';

export const marketingApi = {
  // Campaigns ----------
  listCampaigns: (projectId, { includeArchived = false } = {}) =>
    apiClient
      .get(`/projects/${projectId}/campaigns`, { params: { includeArchived } })
      .then((r) => r.data),

  getCampaign: (campaignId) =>
    apiClient.get(`/campaigns/${campaignId}`).then((r) => r.data),

  createCampaign: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/campaigns`, body).then((r) => r.data),

  updateCampaign: (campaignId, body) =>
    apiClient.patch(`/campaigns/${campaignId}`, body).then((r) => r.data),

  deleteCampaign: (campaignId) =>
    apiClient.delete(`/campaigns/${campaignId}`).then((r) => r.data),

  // Content calendar ----------
  getCalendar: (projectId, { from, to }) =>
    apiClient
      .get(`/projects/${projectId}/content-calendar`, { params: { from, to } })
      .then((r) => r.data),

  // Assets ----------
  getAsset: (assetId) =>
    apiClient.get(`/assets/${assetId}`).then((r) => r.data),

  createAsset: (campaignId, body) =>
    apiClient.post(`/campaigns/${campaignId}/assets`, body).then((r) => r.data),

  updateAsset: (assetId, body) =>
    apiClient.patch(`/assets/${assetId}`, body).then((r) => r.data),

  changeAssetStatus: (assetId, { to, reason }) =>
    apiClient.post(`/assets/${assetId}/status`, { to, reason }).then((r) => r.data),

  rescheduleAsset: (assetId, publishDate) =>
    apiClient.post(`/assets/${assetId}/reschedule`, { publishDate }).then((r) => r.data),

  deleteAsset: (assetId) =>
    apiClient.delete(`/assets/${assetId}`).then((r) => r.data),

  // Marketing tasks ----------
  createTask: (campaignId, body) =>
    apiClient.post(`/campaigns/${campaignId}/tasks`, body).then((r) => r.data),

  updateTask: (taskId, body) =>
    apiClient.patch(`/marketing-tasks/${taskId}`, body).then((r) => r.data),

  deleteTask: (taskId) =>
    apiClient.delete(`/marketing-tasks/${taskId}`).then((r) => r.data),
};
