import axios from 'axios';

// FIX: this previously read `VITE_API_BASE_URL` and defaulted to
// 'http://localhost:5000/api' — but the actual .env only sets
// `VITE_API_URL`, and server.js mounts every route under `/api/v1/...`
// (see backend/src/server.js). So every page using this instance
// (AddGoal.jsx, EditGoal.jsx, ViewGoal.jsx, ListGoal.jsx, etc.) was
// silently hitting the wrong path (missing /v1) unless VITE_API_BASE_URL
// happened to be set somewhere. Falls back to VITE_API_URL first now,
// with a corrected /v1 default as the last resort.
//
// NOTE: there are two separate axios instances in this codebase —
// this file and src/api/axios.js — with different env var names and
// (previously) different defaults. Worth consolidating into one; out of
// scope to merge them here since many pages already import this one
// specifically.
const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically attach authorization token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;