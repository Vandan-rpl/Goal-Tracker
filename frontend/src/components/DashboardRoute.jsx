import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import Dashboard from "../pages/Dashboard/Dashboard";
import { ADMIN_HOME_PATH, isAdminUser } from "../utils/adminHome";

/**
 * /dashboard: the Goal Tracker dashboard, except for the Admin, who is sent
 * to the employee list (after login, and from any page that falls back to
 * /dashboard).
 */
const DashboardRoute = () => {
  const { user } = useAuth();
  return isAdminUser(user) ? <Navigate to={ADMIN_HOME_PATH} replace /> : <Dashboard />;
};

export default DashboardRoute;
