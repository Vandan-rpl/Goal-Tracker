import { Navigate, Outlet } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { getNoTaskAccessHome, hasTaskAccess } from "../utils/goalAccess";

/**
 * Guards every Task Tracker page. Users below grade 303 are sent to the
 * Goal Tracker, or to Innovation Ideas when they don't have that either
 * (the backend returns 403 for task data anyway).
 */
const TaskTrackerRoute = () => {
  const { user } = useAuth();

  if (!hasTaskAccess(user)) {
    return <Navigate to={getNoTaskAccessHome(user)} replace />;
  }

  return <Outlet />;
};

export default TaskTrackerRoute;
