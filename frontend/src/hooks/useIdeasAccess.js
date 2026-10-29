import { useEffect, useState } from "react";
import useAuth from "./useAuth";
import { getTeamMembers } from "../services/teamService";

// "Has reportees" uses the Goal Tracker's own team check: GET /teams/members
// returns the active users whose Reporting Manager or HOD is the logged-in
// user. Cached per token so the sidebar and the route guard share one request
// and a different login re-checks.
let cachedToken = null;
let cachedRequest = null;

const fetchHasReportees = () => {
  const token = localStorage.getItem("token");

  if (token !== cachedToken || !cachedRequest) {
    cachedToken = token;
    cachedRequest = getTeamMembers().then(
      (response) => Boolean(response?.success && response.data?.length > 0),
    );
  }

  return cachedRequest;
};

const useIdeasAccess = () => {
  const { user } = useAuth();
  const role = user?.Role || user?.role || "";

  const [hasReportees, setHasReportees] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    fetchHasReportees().then((result) => {
      if (ignore) return;
      setHasReportees(result);
      setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [user]);

  return { role, hasReportees, loading };
};

export default useIdeasAccess;
