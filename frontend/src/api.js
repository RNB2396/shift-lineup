import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_BASE}/api`
});

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
  getAll: () => api.get('/positions').then(res => res.data)
};

// Lineup API
export const lineupApi = {
  generate: (shiftAssignments) =>
    api.post('/lineup/generate', { shiftAssignments }).then(res => res.data),

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

export default api;
