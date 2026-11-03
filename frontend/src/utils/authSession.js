// Session expiry (401 from the API).
//
// The axios interceptors can't reach AuthContext, so they clear the stored
// session and fire this event; AuthProvider listens for it and clears the
// user, which makes ProtectedRoute redirect to the login page.

export const SESSION_EXPIRED_EVENT = "auth:session-expired";

export const handleSessionExpired = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("token");
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
};
