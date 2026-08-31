import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import notificationApi from "../../api/notificationApi";

/**
 * ============================================================
 * Notification Async Actions
 * ============================================================
 */

export const fetchNotifications = createAsyncThunk(
    "notification/fetchNotifications",
    async (_, thunkAPI) => {
        try {
            const response = await notificationApi.getNotifications();
            return response.data.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || error.message
            );
        }
    }
);

export const fetchNotificationCount = createAsyncThunk(
    "notification/fetchNotificationCount",
    async (_, thunkAPI) => {
        try {
            const response = await notificationApi.getNotificationCount();
            return response.data.data.NotificationCount;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || error.message
            );
        }
    }
);

export const markAsRead = createAsyncThunk(
    "notification/markAsRead",
    async (notificationId, thunkAPI) => {
        try {
            await notificationApi.markAsRead(notificationId);
            return notificationId;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || error.message
            );
        }
    }
);

export const markAllRead = createAsyncThunk(
    "notification/markAllRead",
    async (_, thunkAPI) => {
        try {
            await notificationApi.markAllRead();
            return true;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || error.message
            );
        }
    }
);

export const deleteNotification = createAsyncThunk(
    "notification/deleteNotification",
    async (notificationId, thunkAPI) => {
        try {
            await notificationApi.deleteNotification(notificationId);
            return notificationId;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || error.message
            );
        }
    }
);

export const deleteAllNotifications = createAsyncThunk(
    "notification/deleteAllNotifications",
    async (_, thunkAPI) => {
        try {
            await notificationApi.deleteAllNotifications();
            return true;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || error.message
            );
        }
    }
);

/**
 * ============================================================
 * Initial State
 * ============================================================
 */

const initialState = {

    notifications: [],

    notificationCount: 0,

    loading: false,

    error: null

};

/**
 * ============================================================
 * Slice
 * ============================================================
 */

const notificationSlice = createSlice({

    name: "notification",

    initialState,

    reducers: {

        clearNotificationError(state) {
            state.error = null;
        },

        // Fired from useSocket.js when a 'notification:new' socket event
        // arrives. Prepends the live notification and bumps the unread
        // count, mirroring what a manual refetch would eventually show.
        notificationReceived(state, action) {
            const incoming = action.payload;

            const alreadyExists = state.notifications.some(
                (item) => item.NotificationId === incoming.NotificationId
            );

            if (!alreadyExists) {
                state.notifications.unshift(incoming);
            }

            if (!incoming.IsRead) {
                state.notificationCount += 1;
            }
        }

    },

    extraReducers: (builder) => {

        builder

            // =============================
            // Fetch Notifications
            // =============================

            .addCase(fetchNotifications.pending, (state) => {

                state.loading = true;

            })

            .addCase(fetchNotifications.fulfilled, (state, action) => {

                state.loading = false;

                state.notifications = action.payload;

            })

            .addCase(fetchNotifications.rejected, (state, action) => {

                state.loading = false;

                state.error = action.payload;

            })

            // =============================
            // Notification Count
            // =============================

            .addCase(fetchNotificationCount.fulfilled, (state, action) => {

                state.notificationCount = action.payload;

            })

            // =============================
            // Mark As Read
            // =============================

            .addCase(markAsRead.fulfilled, (state, action) => {

                const notification = state.notifications.find(

                    item => item.NotificationId === action.payload

                );

                if (notification) {

                    notification.IsRead = true;

                }

                state.notificationCount = Math.max(
                    0,
                    state.notificationCount - 1
                );

            })

            // =============================
            // Mark All Read
            // =============================

            .addCase(markAllRead.fulfilled, (state) => {

                state.notifications.forEach(item => {

                    item.IsRead = true;

                });

                state.notificationCount = 0;

            })

            // =============================
            // Delete Notification
            // =============================

            .addCase(deleteNotification.fulfilled, (state, action) => {

                state.notifications = state.notifications.filter(

                    item => item.NotificationId !== action.payload

                );

                state.notificationCount = state.notifications.filter(

                    item => !item.IsRead

                ).length;

            })

            // =============================
            // Delete All
            // =============================

            .addCase(deleteAllNotifications.fulfilled, (state) => {

                state.notifications = [];

                state.notificationCount = 0;

            });

    }

});

export const {

    clearNotificationError,

    notificationReceived

} = notificationSlice.actions;

export default notificationSlice.reducer;