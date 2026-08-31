import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth(); // Assuming loading state exists while checking auth

  // If authentication state is still resolving, show nothing or a loader
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  // If user is not logged in, redirect to login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If roles are specified, check if the logged-in user's role is permitted
  if (allowedRoles && allowedRoles.length > 0) {
    // Case-insensitive role comparison safeguard (e.g., 'Admin' vs 'admin')
    const hasPermission = allowedRoles.some(
      (role) => role.toLowerCase() === user?.Role?.toLowerCase()
    );

    if (!hasPermission) {
      // Redirect unauthorized users back to dashboard instead of login loop
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Render child routes if all checks pass
  return <Outlet />;
};

export default ProtectedRoute;