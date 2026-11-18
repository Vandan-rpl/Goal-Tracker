import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import useAuth from "./useAuth";
import { getTeamMembers } from "../services/teamService";
import { getIdeaFinalApprovers } from "../services/ideaService";

// "Has reportees" uses the Goal Tracker's own team check: GET /teams/members
// returns the active users whose Reporting Manager or HOD is the logged-in
// user. "Is final approver" checks the logged-in user against the active
// idea final approvers. Cached per token so the sidebar and the route guard
// share one request and a different login re-checks.
let cachedToken = null;
let cachedRequest = null;

const getTokenUserId = (token) => {
  try {
    return jwtDecode(token)?.userId ?? null;
  } catch {
    return null;
  }
};

const fetchIdeasAccess = () => {
  const token = localStorage.getItem("token");

  if (token !== cachedToken || !cachedRequest) {
    cachedToken = token;
    const userId = getTokenUserId(token);

    cachedRequest = Promise.all([
      getTeamMembers()
        .then((response) => Boolean(response?.success && response.data?.length > 0))
        .catch(() => false),
      getIdeaFinalApprovers()
        .then((approvers) =>
          userId != null && (approvers || []).some((a) => String(a.UserID) === String(userId)),
        )
        .catch(() => false),
    ]).then(([hasReportees, isFinalApprover]) => ({ hasReportees, isFinalApprover }));
  }

  return cachedRequest;
};

const useIdeasAccess = () => {
  const { user } = useAuth();
  const role = user?.Role || user?.role || "";

  const [hasReportees, setHasReportees] = useState(false);
  const [isFinalApprover, setIsFinalApprover] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    fetchIdeasAccess().then((result) => {
      if (ignore) return;
      setHasReportees(result.hasReportees);
      setIsFinalApprover(result.isFinalApprover);
      setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [user]);

  return { role, hasReportees, isFinalApprover, loading };
};

export default useIdeasAccess;
