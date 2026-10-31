import { useEffect, useState } from "react";
import useAuth from "./useAuth";
import { getTaskAccess } from "../services/taskService";

// GET /tasks/access (isBusinessHead, canViewAll, hasDirectReports) — the
// same checks the backend applies. Cached per token so the sidebar and the
// route guard share one request and a different login re-checks.
let cachedToken = null;
let cachedRequest = null;

const NO_ACCESS = { isBusinessHead: false, canViewAll: false, hasDirectReports: false };

const fetchTaskAccess = () => {
  const token = localStorage.getItem("token");

  if (token !== cachedToken || !cachedRequest) {
    cachedToken = token;
    cachedRequest = getTaskAccess().catch(() => {
      // Retry on the next mount instead of caching the failure.
      cachedRequest = null;
      return NO_ACCESS;
    });
  }

  return cachedRequest;
};

const useTasksAccess = () => {
  const { user } = useAuth();

  const [access, setAccess] = useState(NO_ACCESS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    fetchTaskAccess().then((result) => {
      if (ignore) return;
      setAccess({
        isBusinessHead: Boolean(result?.isBusinessHead),
        canViewAll: Boolean(result?.canViewAll),
        hasDirectReports: Boolean(result?.hasDirectReports),
      });
      setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [user]);

  return { ...access, loading };
};

export default useTasksAccess;
