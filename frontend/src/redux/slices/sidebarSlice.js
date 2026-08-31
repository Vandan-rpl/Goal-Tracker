import { createSlice } from "@reduxjs/toolkit";

// ===========================================
// Local Storage Keys
// ===========================================

const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";

// ===========================================
// Initial State
// ===========================================

const initialState = {
  collapsed:
    JSON.parse(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)) ?? false,

  mobileOpen: false,

  selectedMenu: null,

  expandedMenus: [],
};

// ===========================================
// Slice
// ===========================================

const sidebarSlice = createSlice({
  name: "sidebar",

  initialState,

  reducers: {
    toggleSidebar: (state) => {
      state.collapsed = !state.collapsed;

      localStorage.setItem(
        SIDEBAR_COLLAPSED_KEY,
        JSON.stringify(state.collapsed)
      );
    },

    setSidebarCollapsed: (state, action) => {
      state.collapsed = action.payload;

      localStorage.setItem(
        SIDEBAR_COLLAPSED_KEY,
        JSON.stringify(action.payload)
      );
    },

    toggleMobile: (state) => {
      state.mobileOpen = !state.mobileOpen;
    },

    openMobile: (state) => {
      state.mobileOpen = true;
    },

    closeMobile: (state) => {
      state.mobileOpen = false;
    },

    setSelectedMenu: (state, action) => {
      state.selectedMenu = action.payload;
    },

    toggleExpand: (state, action) => {
      const menuId = action.payload;

      const index = state.expandedMenus.indexOf(menuId);

      if (index > -1) {
        state.expandedMenus.splice(index, 1);
      } else {
        state.expandedMenus.push(menuId);
      }
    },

    expandMenu: (state, action) => {
      const menuId = action.payload;

      if (!state.expandedMenus.includes(menuId)) {
        state.expandedMenus.push(menuId);
      }
    },

    collapseMenu: (state, action) => {
      state.expandedMenus = state.expandedMenus.filter(
        (id) => id !== action.payload
      );
    },

    collapseAllMenus: (state) => {
      state.expandedMenus = [];
    },

    resetSidebar: (state) => {
      state.collapsed = false;
      state.mobileOpen = false;
      state.selectedMenu = null;
      state.expandedMenus = [];

      localStorage.setItem(
        SIDEBAR_COLLAPSED_KEY,
        JSON.stringify(false)
      );
    },
  },
});

// ===========================================
// Actions
// ===========================================

export const {
  toggleSidebar,
  setSidebarCollapsed,
  toggleMobile,
  openMobile,
  closeMobile,
  setSelectedMenu,
  toggleExpand,
  expandMenu,
  collapseMenu,
  collapseAllMenus,
  resetSidebar,
} = sidebarSlice.actions;

// ===========================================
// Selectors
// ===========================================

export const selectSidebarCollapsed = (state) =>
  state.sidebar.collapsed;

export const selectMobileOpen = (state) =>
  state.sidebar.mobileOpen;

export const selectSelectedMenu = (state) =>
  state.sidebar.selectedMenu;

export const selectExpandedMenus = (state) =>
  state.sidebar.expandedMenus;

// ===========================================
// Reducer
// ===========================================

export default sidebarSlice.reducer;