import { Navigate, Outlet } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { getNoGoalAccessHome, hasGoalAccess } from "../utils/goalAccess";

/**
 * Guards every Goal Tracker page. Users below grade 303 are sent to the
 * Task Tracker, or to Innovation Ideas when they don't have that either
 * (the backend returns 403 for goal data anyway).
 */
const GoalsRoute = () => {
  const { user } = useAuth();

  if (!hasGoalAccess(user)) {
    return <Navigate to={getNoGoalAccessHome(user)} replace />;
  }

  return <Outlet />;
};

export default GoalsRoute;
