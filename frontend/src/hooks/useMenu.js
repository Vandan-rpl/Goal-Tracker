import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  fetchMenu,
  selectMenu,
  selectMenuLoading,
  selectMenuError,
  selectActiveMenu,
  selectExpandedMenus,
  selectMenuLastUpdated,
  setActiveMenu,
  toggleExpandedMenu,
  expandAllMenus,
  collapseAllMenus,
} from "../redux/slices/menuSlice";

const useMenu = (autoLoad = true) => {
  const dispatch = useDispatch();

  const menu = useSelector(selectMenu);
  const loading = useSelector(selectMenuLoading);
  const error = useSelector(selectMenuError);
  const activeMenu = useSelector(selectActiveMenu);
  const expandedMenus = useSelector(selectExpandedMenus);
  const lastUpdated = useSelector(selectMenuLastUpdated);

  /**
   * Fetch Menu
   */
  const refresh = useCallback(() => {
    dispatch(fetchMenu());
  }, [dispatch]);

  /**
   * Set Active Menu
   */
  const selectMenuItem = useCallback(
    (menuId) => {
      dispatch(setActiveMenu(menuId));
    },
    [dispatch]
  );

  /**
   * Expand / Collapse Parent Menu
   */
  const toggleMenu = useCallback(
    (menuId) => {
      dispatch(toggleExpandedMenu(menuId));
    },
    [dispatch]
  );

  /**
   * Expand All
   */
  const expandMenus = useCallback(() => {
    dispatch(expandAllMenus());
  }, [dispatch]);

  /**
   * Collapse All
   */
  const collapseMenus = useCallback(() => {
    dispatch(collapseAllMenus());
  }, [dispatch]);

  /**
   * Load menu on mount
   */
  useEffect(() => {
    if (autoLoad && menu.length === 0) {
      refresh();
    }
  }, [autoLoad, menu.length, refresh]);

  return {
    menu,
    loading,
    error,
    activeMenu,
    expandedMenus,
    lastUpdated,

    refresh,

    selectMenu: selectMenuItem,

    toggleMenu,

    expandMenus,

    collapseMenus,
  };
};

export default useMenu;