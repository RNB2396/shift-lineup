import axios from 'axios';
import { supabase } from './lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_BASE}/api`
});

// Store ID storage (set by AuthContext when store is selected)
let currentStoreId = null;

export const setCurrentStoreId = (storeId) => {
  currentStoreId = storeId;
};

// Add auth interceptor to include token and store ID in requests
api.interceptors.request.use(async (config) => {
  // Get current session token
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  }

  // Add store ID header
  if (currentStoreId) {
    config.headers['X-Store-Id'] = currentStoreId;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Could trigger logout here if needed
      console.error('Unauthorized request:', error.response?.data?.error);
    }
    return Promise.reject(error);
  }
);

// Employee API
export const employeeApi = {
  getAll: () => api.get('/employees').then(res => res.data),
  get: (id) => api.get(`/employees/${id}`).then(res => res.data),
  create: (employee) => api.post('/employees', employee).then(res => res.data),
  update: (id, employee) => api.put(`/employees/${id}`, employee).then(res => res.data),
  delete: (id) => api.delete(`/employees/${id}`)
};

// Position API
export const positionApi = {
  getAll: (houseType) => {
    const params = houseType ? { houseType } : {};
    return api.get('/positions', { params }).then(res => res.data);
  },
  get: (id) => api.get(`/positions/${id}`).then(res => res.data),
  create: (position) => api.post('/positions', position).then(res => res.data),
  update: (id, position) => api.put(`/positions/${id}`, position).then(res => res.data),
  delete: (id) => api.delete(`/positions/${id}`)
};

// Lineup API
export const lineupApi = {
  generate: (shiftAssignments, houseType) =>
    api.post('/lineup/generate', { shiftAssignments, houseType }).then(res => res.data),

  exportExcel: async (lineups) => {
    const response = await api.post('/lineup/export', { lineups }, {
      responseType: 'blob'
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `lineup_${new Date().toISOString().split('T')[0]}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
};

// Auth API
export const authApi = {
  getMe: () => api.get('/auth/me').then(res => res.data)
};

export default api;
