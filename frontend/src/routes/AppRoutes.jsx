import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';

// Layouts
import DashboardLayout from '../components/layouts/DashboardLayout';

// Auth Pages
import Login from '../pages/auth/Login';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';

// Dashboard & Goals
import Dashboard from '../pages/dashboard/Dashboard';
import ListGoal from '../pages/goals/ListGoal';
import AddGoal from '../pages/goals/AddGoal';
import EditGoal from '../pages/goals/EditGoal';
import ViewGoal from '../pages/goals/ViewGoal';
import GoalReview from '../pages/goals/GoalReview';

// Admin Pages
import AddEmployees from '../pages/admin/AddEmployees';
import EmployeeExcelUpload from '../pages/admin/EmployeeExcelUpload';
import ListEmployees from '../pages/admin/ListEmployees'; 


import Setting from '../pages/Settings/Settings';
import Profile from '../pages/Profile/Profile';
// Manager/HOD Pages
import ReviewEmployeeGoal from '../pages/manager/ReviewEmployeeGoal';
import TeamManagement from '../pages/manager/TeamManagement';

// CFO Pages
import CFOAllUsersGoals from '../pages/cfo/CFOAllUsersGoals';

const AppRoutes = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Application Layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/setting" element={<Setting />} />
              <Route path="/profile" element={<Profile />} />
              {/* Goal Management Routes */}
              <Route path="/goals" element={<ListGoal />} />
              <Route path="/goals/add" element={<AddGoal />} />
              <Route path="/goals/edit/:id" element={<EditGoal />} />
              <Route path="/goals/view/:id" element={<ViewGoal />} />
              
              {/* Admin Routes (Restricted to Admin Role) */}
              <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
                <Route path="/admin/add-employees" element={<AddEmployees />} />
                <Route path="/admin/employees-list" element={<ListEmployees />} /> {/* <-- List Employees Route Added */}
                <Route path="/admin/upload-excel" element={<EmployeeExcelUpload />} />
              </Route>

              {/* HOD / Manager / CFO / Admin Routes for Team Management & Review */}
              <Route element={<ProtectedRoute allowedRoles={['HOD', 'Manager', 'BusinessHead', 'CFO', 'Admin']} />}>
                <Route path="/manager/team-management" element={<TeamManagement />} />
                <Route path="/manager/review-employee-goal" element={<ReviewEmployeeGoal />} />
                <Route path="/goals/review" element={<GoalReview />} />
              </Route>

              {/* CFO Specific Routes */}
              <Route element={<ProtectedRoute allowedRoles={['CFO', 'BusinessHead', 'Admin']} />}>
                <Route path="/cfo/all-goals" element={<CFOAllUsersGoals />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback Redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default AppRoutes;