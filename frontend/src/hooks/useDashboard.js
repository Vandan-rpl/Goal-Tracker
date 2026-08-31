import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  fetchDashboard,
  selectDashboard,
  selectDashboardLoading,
  selectDashboardError,
  selectDashboardLastUpdated,
} from "../redux/slices/dashboardSlice";

const useDashboard = (autoLoad = true) => {
  const dispatch = useDispatch();

  const dashboard = useSelector(selectDashboard);
  const loading = useSelector(selectDashboardLoading);
  const error = useSelector(selectDashboardError);
  const lastUpdated = useSelector(selectDashboardLastUpdated);

  /**
   * Fetch Dashboard Summary
   */
  const refresh = useCallback(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  /**
   * Auto Load Dashboard
   */
  useEffect(() => {
    if (autoLoad) {
      refresh();
    }
  }, [autoLoad, refresh]);

  return {
    dashboard,
    loading,
    error,
    lastUpdated,
    refresh,
  };
};

export default useDashboard;