import { apiClient } from './client';

export const supportApi = {
  // Queue view + queues ----------
  getQueueView: (projectId) =>
    apiClient.get(`/projects/${projectId}/queue-view`).then((r) => r.data),

  listQueues: (projectId) =>
    apiClient.get(`/projects/${projectId}/queues`).then((r) => r.data),

  createQueue: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/queues`, body).then((r) => r.data),

  updateQueue: (queueId, body) =>
    apiClient.patch(`/queues/${queueId}`, body).then((r) => r.data),

  deleteQueue: (queueId) =>
    apiClient.delete(`/queues/${queueId}`).then((r) => r.data),

  // Customers ----------
  listCustomers: (projectId, { search } = {}) =>
    apiClient.get(`/projects/${projectId}/customers`, { params: { search } }).then((r) => r.data),

  getCustomer: (customerId) =>
    apiClient.get(`/customers/${customerId}`).then((r) => r.data),

  createCustomer: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/customers`, body).then((r) => r.data),

  updateCustomer: (customerId, body) =>
    apiClient.patch(`/customers/${customerId}`, body).then((r) => r.data),

  // Tickets ----------
  getTicket: (ticketId, { includeInternal = true } = {}) =>
    apiClient.get(`/tickets/${ticketId}`, { params: { includeInternal } }).then((r) => r.data),

  createTicket: (projectId, body) =>
    apiClient.post(`/projects/${projectId}/tickets`, body).then((r) => r.data),

  updateTicket: (ticketId, body) =>
    apiClient.patch(`/tickets/${ticketId}`, body).then((r) => r.data),

  changeStatus: (ticketId, to) =>
    apiClient.post(`/tickets/${ticketId}/status`, { to }).then((r) => r.data),

  // Replies ----------
  addReply: (ticketId, { bodyMd, isInternal }) =>
    apiClient.post(`/tickets/${ticketId}/replies`, { bodyMd, isInternal }).then((r) => r.data),
};
