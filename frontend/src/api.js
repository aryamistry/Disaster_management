import axios from 'axios';

const API = axios.create({ baseURL: '/api', timeout: 10000 });

export const getRiskScores = () => API.get('/risk/scores').then(r => r.data.data);
export const getRiskSummary = () => API.get('/risk/summary').then(r => r.data.data);
export const triggerRiskCompute = (spike = false) => API.post('/risk/trigger', { spike }).then(r => r.data);
export const getAlerts = (params = {}) => API.get('/alerts', { params }).then(r => r.data.data);
export const getActiveAlerts = () => API.get('/alerts/active').then(r => r.data.data);
export const updateAlertStatus = (id, status, acknowledged_by) => API.patch(`/alerts/${id}/status`, { status, acknowledged_by }).then(r => r.data);
export const getReports = () => API.get('/reports').then(r => r.data.data);
export const getReportById = (id) => API.get(`/reports/${id}`).then(r => r.data.data).catch(() => null);
export const submitReport = (formData) => API.post('/reports', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const syncReports = (reports) => API.post('/reports/sync-batch', { reports: JSON.stringify(reports) }).then(r => r.data);
export const getAdminConfig = () => API.get('/admin/config').then(r => r.data.data);
export const updateAdminConfig = (updates) => API.patch('/admin/config', updates).then(r => r.data);
export const getHealthStatus = () => API.get('/admin/health').then(r => r.data.data);
export const getUsers = () => API.get('/admin/users').then(r => r.data.data);
export const getAdminDistricts = () => API.get('/admin/districts').then(r => r.data.data);
// FIX-5.2: Road corridors and village positions come from backend (single source of truth)
export const getGeoFeatures = () => API.get('/admin/geo-features').then(r => r.data.data);
export const getHistoricalLandslides = () => API.get('/ingest/historical-landslides').then(r => r.data.data).catch(() => []);
export const getSensorReadings = (grid_id) => API.get('/ingest/sensor-readings', { params: { grid_id, limit: 24 } }).then(r => r.data.data);
export const getForecast = () => API.get('/ingest/forecast').then(r => r.data.data);
export const getRiskHistory = (gridId) => API.get(`/risk/history/${gridId}`).then(r => r.data.data);
export const getPrioritization = () => API.get('/risk/prioritization').then(r => r.data.data);

export default API;
