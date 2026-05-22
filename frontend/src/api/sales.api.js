import { apiClient } from './client';

export const salesApi = {
  // Pipeline + stages ----------
  getPipeline: (projectId) =>
    apiClient.get(`/projects/${projectId}/pipeline`).then((r) => r.data),

  listStages: (projectId) =>
    apiClient.get(`/projects/${projectId}/deal-stages`).then((r) => r.data),

  createStage: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/deal-stages`, body).then((r) => r.data),

  updateStage: (stageId, body) =>
    apiClient.patch(`/deal-stages/${stageId}`, body).then((r) => r.data),

  reorderStages: (projectId, orderedIds) =>
    apiClient.post(`/projects/${projectId}/deal-stages/reorder`, { orderedIds }).then((r) => r.data),

  deleteStage: (stageId) =>
    apiClient.delete(`/deal-stages/${stageId}`).then((r) => r.data),

  // Accounts ----------
  listAccounts: (projectId, { includeArchived = false } = {}) =>
    apiClient
      .get(`/projects/${projectId}/accounts`, { params: { includeArchived } })
      .then((r) => r.data),

  getAccount: (accountId) =>
    apiClient.get(`/accounts/${accountId}`).then((r) => r.data),

  createAccount: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/accounts`, body).then((r) => r.data),

  updateAccount: (accountId, body) =>
    apiClient.patch(`/accounts/${accountId}`, body).then((r) => r.data),

  // Deals ----------
  getDeal: (dealId) =>
    apiClient.get(`/deals/${dealId}`).then((r) => r.data),

  createDeal: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/deals`, body).then((r) => r.data),

  updateDeal: (dealId, body) =>
    apiClient.patch(`/deals/${dealId}`, body).then((r) => r.data),

  changeDealStage: (dealId, { toStageId, reason }) =>
    apiClient
      .post(`/deals/${dealId}/change-stage`, { toStageId, reason })
      .then((r) => r.data),

  // Activities ----------
  listActivities: (dealId) =>
    apiClient.get(`/deals/${dealId}/activities`).then((r) => r.data),

  createActivity: (dealId, body) =>
    apiClient.post(`/deals/${dealId}/activities`, body).then((r) => r.data),

  // Leads ----------
  listLeads: (projectId, { status } = {}) =>
    apiClient.get(`/projects/${projectId}/leads`, { params: { status } }).then((r) => r.data),

  createLead: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/leads`, body).then((r) => r.data),

  updateLead: (leadId, body) =>
    apiClient.patch(`/leads/${leadId}`, body).then((r) => r.data),

  convertLead: (leadId, body) =>
    apiClient.post(`/leads/${leadId}/convert`, body).then((r) => r.data),
};
