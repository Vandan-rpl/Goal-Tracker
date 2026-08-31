import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
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
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        window.location.href = "/login";
        break;

      case 403:
        console.error("Access Denied");
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