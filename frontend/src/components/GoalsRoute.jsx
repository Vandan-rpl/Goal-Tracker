import { Navigate, Outlet } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { NO_GOAL_ACCESS_HOME, hasGoalAccess } from "../utils/goalAccess";

/**
 * Guards every Goal Tracker page. Users below grade 303 are sent to the
 * Task Tracker (the backend returns 403 for goal data anyway).
 */
const GoalsRoute = () => {
  const { user } = useAuth();

  if (!hasGoalAccess(user)) {
    return <Navigate to={NO_GOAL_ACCESS_HOME} replace />;
  }

  return <Outlet />;
};

export default GoalsRoute;
