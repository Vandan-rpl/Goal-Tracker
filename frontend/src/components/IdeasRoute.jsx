import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import useIdeasAccess from "../hooks/useIdeasAccess";
import {
  IDEAS_HOME_PATH,
  canAccessIdeasItem,
  getIdeasMenuItem,
} from "../utils/ideasMenu";

/**
 * Guards an Ideas page that only some users have in their menu. Anyone
 * else who opens the URL directly is sent to My Ideas.
 *
 * Usage:
 *   <Route element={<IdeasRoute menuKey="team" />}>
 *     <Route path="/ideas/team" element={<TeamIdeas />} />
 *   </Route>
 */
const IdeasRoute = ({ menuKey }) => {
  const access = useIdeasAccess();
  const item = getIdeasMenuItem(menuKey);

  if (access.loading) {
    return <div className="flex justify-center items-center h-64 text-sm text-gray-500">Loading...</div>;
  }

  if (!item || !canAccessIdeasItem(item, access)) {
    return <Navigate to={IDEAS_HOME_PATH} replace />;
  }

  return <Outlet />;
};

export default IdeasRoute;
