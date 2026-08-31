import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import dashboardApi from "../../api/dashboardApi";

// ===========================================
// Async Thunks
// ===========================================

export const fetchMenu = createAsyncThunk(
  "menu/fetchMenu",
  async (_, { rejectWithValue }) => {
    try {
      const response = await dashboardApi.getMenu();

      if (response.success) {
        return response.data;
      }

      return rejectWithValue(response.message || "Unable to load menu.");
    } catch (error) {
      return rejectWithValue(
        error?.message ||
          error?.response?.data?.message ||
          "Something went wrong."
      );
    }
  }
);

// ===========================================
// Initial State
// ===========================================

const initialState = {
  loading: false,

  menu: [],

  activeMenu: null,

  expandedMenus: [],

  error: null,

  lastUpdated: null,
};

// ===========================================
// Slice
// ===========================================

const menuSlice = createSlice({
  name: "menu",

  initialState,

  reducers: {
    setMenu: (state, action) => {
      state.menu = action.payload || [];
    },

    clearMenu: (state) => {
      state.menu = [];
      state.activeMenu = null;
      state.expandedMenus = [];
      state.error = null;
      state.lastUpdated = null;
    },

    resetMenu: () => initialState,

    setActiveMenu: (state, action) => {
      state.activeMenu = action.payload;
    },

    toggleExpandedMenu: (state, action) => {
      const menuId = action.payload;

      if (state.expandedMenus.includes(menuId)) {
        state.expandedMenus = state.expandedMenus.filter(
          (id) => id !== menuId
        );
      } else {
        state.expandedMenus.push(menuId);
      }
    },

    expandAllMenus: (state) => {
      state.expandedMenus = state.menu.map((menu) => menu.id);
    },

    collapseAllMenus: (state) => {
      state.expandedMenus = [];
    },
  },

  extraReducers: (builder) => {
    builder

      // Pending
      .addCase(fetchMenu.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      // Success
      .addCase(fetchMenu.fulfilled, (state, action) => {
        state.loading = false;
        state.menu = action.payload;
        state.error = null;
        state.lastUpdated = new Date().toISOString();
      })

      // Failed
      .addCase(fetchMenu.rejected, (state, action) => {
        state.loading = false;
        state.menu = [];
        state.error = action.payload || "Failed to load menu.";
      });
  },
});

// ===========================================
// Actions
// ===========================================

export const {
  setMenu,
  clearMenu,
  resetMenu,
  setActiveMenu,
  toggleExpandedMenu,
  expandAllMenus,
  collapseAllMenus,
} = menuSlice.actions;

// ===========================================
// Selectors
// ===========================================

export const selectMenu = (state) => state.menu.menu;

export const selectMenuLoading = (state) => state.menu.loading;

export const selectMenuError = (state) => state.menu.error;

export const selectActiveMenu = (state) => state.menu.activeMenu;

export const selectExpandedMenus = (state) =>
  state.menu.expandedMenus;

export const selectMenuLastUpdated = (state) =>
  state.menu.lastUpdated;

// ===========================================
// Reducer
// ===========================================

export default menuSlice.reducer;