import axios from "axios";
import { handlePasswordChangeRequired } from "../utils/passwordChange";
import { handleSessionExpired } from "../utils/authSession";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ==============================
// Request Interceptor
// ==============================
axiosInstance.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ==============================
// Response Interceptor
// ==============================
axiosInstance.interceptors.response.use(
  (response) => response,

  (error) => {
    if (!error.response) {
      return Promise.reject({
        success: false,
        message: "Network Error. Please check your internet connection.",
      });
    }

    const { status, data } = error.response;

    switch (status) {
      case 401:
        // A failed login is also a 401; that's a wrong password, not an
        // expired session, so leave it to the login page to report.
        if (!error.config?.url?.includes("/auth/login")) {
          handleSessionExpired();
        }
        break;

      case 403:
        if (!handlePasswordChangeRequired(data)) {
          console.error("Access Denied");
        }
        break;

      case 404:
        console.error("API Not Found");
        break;

      case 500:
        console.error("Internal Server Error");
        break;

      default:
        break;
    }

    return Promise.reject(data || error);
  }
);

export default axiosInstance;