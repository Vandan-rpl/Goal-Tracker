import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import dashboardApi from "../../api/dashboardApi";

// ===========================================
// Async Thunk
// ===========================================

export const fetchDashboard = createAsyncThunk(
  "dashboard/fetchDashboard",
  async (_, { rejectWithValue }) => {
    try {
      const response = await dashboardApi.getDashboardHome();

      if (response.success) {
        return response.data;
      }

      return rejectWithValue(response.message || "Unable to fetch dashboard.");
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

  dashboard: null,

  error: null,

  lastUpdated: null,
};

// ===========================================
// Slice
// ===========================================

const dashboardSlice = createSlice({
  name: "dashboard",

  initialState,

  reducers: {
    clearDashboard: (state) => {
      state.dashboard = null;
      state.error = null;
      state.lastUpdated = null;
    },

    resetDashboard: () => initialState,
  },

  extraReducers: (builder) => {
    builder

      // Pending
      .addCase(fetchDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      // Success
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.dashboard = action.payload;
        state.lastUpdated = new Date().toISOString();
        state.error = null;
      })

      // Failed
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.dashboard = null;
        state.error = action.payload || "Failed to load dashboard.";
      });
  },
});

// ===========================================
// Actions
// ===========================================

export const { clearDashboard, resetDashboard } =
  dashboardSlice.actions;

// ===========================================
// Selectors
// ===========================================

export const selectDashboard = (state) => state.dashboard.dashboard;

export const selectDashboardLoading = (state) =>
  state.dashboard.loading;

export const selectDashboardError = (state) =>
  state.dashboard.error;

export const selectDashboardLastUpdated = (state) =>
  state.dashboard.lastUpdated;

// ===========================================
// Reducer
// ===========================================

export default dashboardSlice.reducer;