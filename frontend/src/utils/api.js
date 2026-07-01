const API_BASE = 'http://localhost:5000/api';

/**
 * Custom fetch wrapper to include credentials and headers
 */
async function apiRequest(path, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    // Required to send cookies (like the JWT token) in requests
    credentials: 'include'
  };

  // If a bearer token exists in localStorage, pass it as fallback header
  const token = localStorage.getItem('token');
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
  }

  return response.json();
}

const api = {
  // Auth API
  auth: {
    async login(email, password) {
      const data = await apiRequest('/auth/login', 'POST', { email, password });
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      return data;
    },
    async register(fullName, email, password, matricStaffId) {
      return apiRequest('/auth/register', 'POST', {
        full_name: fullName,
        email,
        password,
        matric_staff_id: matricStaffId
      });
    },
    async logout() {
      localStorage.removeItem('token');
      return apiRequest('/auth/logout', 'POST');
    },
    async getMe() {
      return apiRequest('/auth/me', 'GET');
    }
  },

  // Officials API
  officials: {
    async list() {
      return apiRequest('/officials', 'GET');
    },
    async getAvailability(officialId, date) {
      return apiRequest(`/officials/${officialId}/availability?date=${date}`, 'GET');
    }
  },

  // Appointments API (Visitor)
  appointments: {
    async create(officialId, date, time, purpose) {
      return apiRequest('/appointments', 'POST', {
        official_id: officialId,
        requested_date: date,
        requested_time: time,
        purpose
      });
    },
    async getMine() {
      return apiRequest('/appointments/mine', 'GET');
    },
    async cancel(id) {
      return apiRequest(`/appointments/${id}/cancel`, 'PATCH');
    },
    async acceptReschedule(id) {
      return apiRequest(`/appointments/${id}/accept-reschedule`, 'PATCH');
    }
  },

  // Secretary API (Delegated Module)
  secretary: {
    async getAppointments() {
      return apiRequest('/appointments/secretary', 'GET');
    },
    async approve(id) {
      return apiRequest(`/appointments/secretary/${id}/approve`, 'PATCH');
    },
    async reject(id, note) {
      return apiRequest(`/appointments/secretary/${id}/reject`, 'POST', { note });
    },
    async reschedule(id, date, time, note) {
      return apiRequest(`/appointments/secretary/${id}/reschedule`, 'POST', {
        rescheduled_date: date,
        rescheduled_time: time,
        note
      });
    },
    async checkIn(id, qrToken) {
      return apiRequest(`/appointments/secretary/${id}/complete`, 'PATCH', { qr_token: qrToken });
    },
    async updateOfficialAvailability(data) {
      return apiRequest('/appointments/secretary/official', 'PUT', data);
    },
    async getBlackoutDates() {
      return apiRequest('/appointments/secretary/blackouts', 'GET');
    },
    async addBlackoutDate(date, reason) {
      return apiRequest('/appointments/secretary/blackouts', 'POST', { date, reason });
    },
    async deleteBlackoutDate(id) {
      return apiRequest(`/appointments/secretary/blackouts/${id}`, 'DELETE');
    }
  },

  // Notifications API
  notifications: {
    async list() {
      return apiRequest('/notifications', 'GET');
    },
    async markRead(id) {
      return apiRequest(`/notifications/${id}/read`, 'PATCH');
    },
    async markAllRead() {
      return apiRequest('/notifications/read-all', 'PATCH');
    }
  },

  // Admin API
  admin: {
    async getStats() {
      return apiRequest('/admin/stats', 'GET');
    },
    async getExportAppointments() {
      return apiRequest('/admin/export/appointments', 'GET');
    },
    async getExportLogs() {
      return apiRequest('/admin/export/logs', 'GET');
    },
    async getOfficials() {
      return apiRequest('/admin/officials', 'GET');
    },
    async createOfficial(data) {
      return apiRequest('/admin/officials', 'POST', data);
    },
    async updateOfficial(id, data) {
      return apiRequest(`/admin/officials/${id}`, 'PUT', data);
    },
    async createSecretary(data) {
      return apiRequest('/admin/secretaries', 'POST', data);
    },
    async getUnassignedSecretaries() {
      return apiRequest('/admin/secretaries/unassigned', 'GET');
    },
    async getAllSecretaries() {
      return apiRequest('/admin/secretaries/all', 'GET');
    }
  }
};

export default api;
