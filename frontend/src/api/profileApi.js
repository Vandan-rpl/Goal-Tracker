import axiosInstance from "../api/axios";

const BASE_URL = "/profile";

/**
 * Get Logged-in User Profile
 */
const getProfile = () => {
    return axiosInstance.get(BASE_URL);
};

/**
 * Update Profile
 */
const updateProfile = (profileData) => {
    return axiosInstance.put(BASE_URL, profileData);
};

/**
 * Upload Profile Avatar
 */
const uploadAvatar = (formData) => {
    return axiosInstance.post(
        `${BASE_URL}/avatar`,
        formData,
        {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        }
    );
};
const changePassword = (passwordData) => {
    return axiosInstance.put(`${BASE_URL}/change-password`, passwordData);
};

/**
 * Remove Profile Avatar
 */
const removeAvatar = () => {
    return axiosInstance.delete(`${BASE_URL}/avatar`);
};


/**
 * Get Login History
 */
const getLoginHistory = () => {
    return axiosInstance.get(
        `${BASE_URL}/login-history`
    );
};

const profileApi = {
    getProfile,
    updateProfile,
    uploadAvatar,
    removeAvatar,
    changePassword,
    getLoginHistory,
};

export default profileApi;