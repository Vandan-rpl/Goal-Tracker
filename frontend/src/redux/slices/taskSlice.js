import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getTaskUnseenCount } from "../../services/taskService";

/**
 * Task Tracker badge: the user's tasks with IsSeenByUser = 0. Fetched by the
 * Header on every navigation and pushed live by the 'task:unseen-count'
 * socket event (see hooks/useSocket.js).
 */
export const fetchTaskUnseenCount = createAsyncThunk(
    "task/fetchTaskUnseenCount",
    async (_, thunkAPI) => {
        try {
            return await getTaskUnseenCount();
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || error.message
            );
        }
    }
);

const taskSlice = createSlice({
    name: "task",
    initialState: {
        unseenCount: 0,
    },
    reducers: {
        taskUnseenCountReceived: (state, action) => {
            const count = Number(action.payload);
            state.unseenCount = Number.isFinite(count) && count > 0 ? count : 0;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(fetchTaskUnseenCount.fulfilled, (state, action) => {
            state.unseenCount = Number(action.payload) || 0;
        });
    },
});

export const { taskUnseenCountReceived } = taskSlice.actions;

export default taskSlice.reducer;
