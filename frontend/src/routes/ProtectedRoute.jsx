import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { needsPasswordChange, FORCE_RESET_PATH } from '../utils/passwordChange';

const ProtectedRoute = ({ allowedRoles }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Enforce the temporary-password change. The backend enforces this too
  // (403 PASSWORD_CHANGE_REQUIRED); this just avoids rendering pages whose
  // API calls would all be rejected.
  if (needsPasswordChange(user)) {
    return <Navigate to={FORCE_RESET_PATH} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;