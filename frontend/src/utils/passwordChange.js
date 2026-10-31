// Forced password change (temporary / default password).
//
// The backend is the real gate: every protected API returns
// 403 { code: "PASSWORD_CHANGE_REQUIRED" } while Users.DefaultPasswordFlag = 1
// (see backend/src/middleware/authMiddleware.js). The helpers below only keep
// the UI in step with that.

export const PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED";
export const FORCE_RESET_PATH = "/force-reset-password";

// Login returns both flags; the backend derives isPasswordChanged from
// defaultPasswordFlag, so either one being set means a change is required.
export const needsPasswordChange = (user) =>
  !!user && (user.defaultPasswordFlag === true || user.isPasswordChanged === false);

export const withPasswordChangeState = (user, mustChange) => ({
  ...user,
  defaultPasswordFlag: mustChange,
  isPasswordChanged: !mustChange,
});

// Called by the axios response interceptors. The interceptors can't reach
// AuthContext, so the stored user is updated and the page fully reloaded on
// the force-reset screen, where AuthProvider re-reads localStorage.
export const handlePasswordChangeRequired = (data) => {
  if (data?.code !== PASSWORD_CHANGE_REQUIRED) return false;

  try {
    const stored = localStorage.getItem("user");
    if (stored) {
      localStorage.setItem(
        "user",
        JSON.stringify(withPasswordChangeState(JSON.parse(stored), true)),
      );
    }
  } catch {
    // Unreadable stored user: the force-reset page sends them to login.
  }

  if (window.location.pathname !== FORCE_RESET_PATH) {
    window.location.assign(FORCE_RESET_PATH);
  }
  return true;
};
