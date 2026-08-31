import axiosInstance from "./axios"; // Make sure path matches your project structure

/**
 * ============================================================
 * Authentication API Service
 * Enterprise Goal Tracker Management System
 * ============================================================
 */

/**
 * User Login API Call
 */
export const loginUser = async (data) => {
    console.log("📤 Calling Login API...");
    console.log(data);

    // Using the unified axiosInstance with correct /api/v1 prefix
    const response = await axiosInstance.post("/auth/login", data);

    console.log("✅ Login Response:", response);

    return response.data;
};

/**
 * Change Password API Call
 */
export const changePassword = async (data) => {
    const response = await axiosInstance.put("/auth/change-password", data);

    return response.data;
};

export default {
    loginUser,
    changePassword
};