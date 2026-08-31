import axiosInstance from "./axios";

const notificationApi = {
  getNotifications() {
    return axiosInstance.get("/notifications");
  },

  getNotificationCount() {
    return axiosInstance.get("/notifications/count");
  },

  markAsRead(notificationId) {
    return axiosInstance.put(`/notifications/${notificationId}/read`);
  },

  markAllRead() {
    return axiosInstance.put("/notifications/read-all");
  },

  deleteNotification(notificationId) {
    return axiosInstance.delete(`/notifications/${notificationId}`);
  },

  deleteAllNotifications() {
    return axiosInstance.delete("/notifications");
  },
};

export default notificationApi;