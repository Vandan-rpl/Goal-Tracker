import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import profileReducer from "./slices/profileSlice"; // <-- આ ઇમ્પોર્ટ હોવું જરૂરી છે
import dashboardReducer from "./slices/dashboardSlice";
import menuReducer from "./slices/menuSlice";
import sidebarReducer from "./slices/sidebarSlice";
import notificationReducer from "./slices/notificationSlice";

export const store = configureStore({
    reducer: {
        auth: authReducer,
        profile: profileReducer, // <-- આ લાઇન ઉમેરેલી હોવી જોઈએ
        dashboard: dashboardReducer,
        menu: menuReducer,
        sidebar: sidebarReducer,
        notification: notificationReducer
    },
    // ... middleware / devTools configs ...
});

export default store;