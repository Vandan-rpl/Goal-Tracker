import axiosInstance from "./axios";

/**
 * Dashboard API Service
 * Module: Dashboard Framework
 */
const dashboardApi = {
  /**
   * Get Dashboard Summary
   * GET /api/v1/dashboard/home
   */
  getDashboardHome: async () => {
    try {
      const response = await axiosInstance.get("/dashboard/home");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get Dynamic Sidebar Menu
   * GET /api/v1/dashboard/menu
   */
  getMenu: async () => {
    try {
      const response = await axiosInstance.get("/dashboard/menu");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get Logged-in User Profile
   * GET /api/v1/dashboard/profile
   */
  getProfile: async () => {
    try {
      const response = await axiosInstance.get("/dashboard/profile");
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default dashboardApi;