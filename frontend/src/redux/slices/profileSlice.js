import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import profileApi from "../../api/profileApi";

/* ============================================================
   Async Actions
============================================================ */

export const fetchProfile = createAsyncThunk(
    "profile/fetchProfile",
    async (_, thunkAPI) => {
        try {
            const response = await profileApi.getProfile();
            return response.data.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || error.message
            );
        }
    }
);

export const updateProfile = createAsyncThunk(
    "profile/updateProfile",
    async (data, thunkAPI) => {
        try {
            const response = await profileApi.updateProfile(data);
            return response.data.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || error.message
            );
        }
    }
);

export const uploadAvatar = createAsyncThunk(
    "profile/uploadAvatar",
    async (formData, thunkAPI) => {
        try {
            const response = await profileApi.uploadAvatar(formData);
            return response.data.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || error.message
            );
        }
    }
);

export const removeAvatar = createAsyncThunk(
    "profile/removeAvatar",
    async (_, thunkAPI) => {
        try {
            await profileApi.removeAvatar();
            return true;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || error.message
            );
        }
    }
);

export const changePassword = createAsyncThunk(
    "profile/changePassword",
    async (passwordData, thunkAPI) => {
        try {
            const response = await profileApi.changePassword(passwordData);
            return response.data.message;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || error.message
            );
        }
    }
);

/* ============================================================
   Initial State
============================================================ */

const initialState = {
    profile: null,
    loading: false,
    success: false,
    error: null,
    passwordChanged: false
};

/* ============================================================
   Slice
============================================================ */

const profileSlice = createSlice({
    name: "profile",

    initialState,

    reducers: {
        clearProfileError(state) {
            state.error = null;
        },

        clearProfileSuccess(state) {
            state.success = false;
        },

        clearPasswordStatus(state) {
            state.passwordChanged = false;
        }
    },

    extraReducers: (builder) => {
        builder

            // Fetch Profile
            .addCase(fetchProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.profile = action.payload;
            })
            .addCase(fetchProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            // Update Profile
            .addCase(updateProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.profile = action.payload;
            })
            .addCase(updateProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            // Upload Avatar
            .addCase(uploadAvatar.pending, (state) => {
                state.loading = true;
            })
            .addCase(uploadAvatar.fulfilled, (state, action) => {
                state.loading = false;

                if (state.profile) {
                    state.profile.ProfilePhoto = action.payload.ProfilePhoto;
                }

                state.success = true;
            })
            .addCase(uploadAvatar.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            // Remove Avatar
            .addCase(removeAvatar.fulfilled, (state) => {
                if (state.profile) {
                    state.profile.ProfilePhoto = null;
                }

                state.success = true;
            })

            // Change Password
            .addCase(changePassword.pending, (state) => {
                state.loading = true;
            })
            .addCase(changePassword.fulfilled, (state) => {
                state.loading = false;
                state.passwordChanged = true;
                state.success = true;
            })
            .addCase(changePassword.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    }
});

export const {
    clearProfileError,
    clearProfileSuccess,
    clearPasswordStatus
} = profileSlice.actions;

export default profileSlice.reducer;