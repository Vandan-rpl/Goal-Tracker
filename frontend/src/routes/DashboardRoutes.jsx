import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import routeConfig, {
  errorRoutes,
} from "./routeConfig";

import DashboardLayout from "../layouts/DashboardLayout";
import ProtectedRoute from "../components/ProtectedRoute/ProtectedRoute";
import FullPageLoader from "../components/loaders/FullPageLoader";

const DashboardRoutes = () => {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        {/* Protected Dashboard Routes */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {routeConfig.map((route) => {
            const Component = route.component;

            return (
              <Route
                key={route.id}
                path={route.path}
                element={
                  <ProtectedRoute permission={route.permission}>
                    <Component />
                  </ProtectedRoute>
                }
              />
            );
          })}
        </Route>

        {/* Error Routes */}
        {errorRoutes.map((route) => {
          const Component = route.component;

          return (
            <Route
              key={route.path}
              path={route.path}
              element={<Component />}
            />
          );
        })}

        {/* Default Dashboard Route */}
        <Route
          path="/"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* Unknown Dashboard Routes */}
        <Route
          path="*"
          element={<Navigate to="/404" replace />}
        />
      </Routes>
    </Suspense>
  );
};

export default DashboardRoutes;