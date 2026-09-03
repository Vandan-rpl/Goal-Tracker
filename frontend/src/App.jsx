import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext'; 
import Login from './pages/Auth/Login';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import ForceResetPassword from './pages/Auth/ForceResetPassword';
import ProtectedRoute from './components/ProtectedRoute'; 
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from './pages/Dashboard/Dashboard';
import ListGoal from './pages/Goals/ListGoal';
import AddGoal from './pages/Goals/AddGoal';
import EditGoal from './pages/Goals/EditGoal';
import ViewGoal from './pages/Goals/ViewGoal';
import QuarterlyUpdate from './pages/Goals/QuarterlyUpdate';
import FinalEvaluation from './pages/Goals/FinalEvaluation';
import GoalReview from './pages/Goals/GoalReview';
import AddEmployees from './pages/Admin/AddEmployees';
import Setting from './pages/Settings/Settings';
import Profile from './pages/Profile/Profile';
import ChangePassword from './pages/Auth/ChangePassword';
import EmployeeExcelUpload from './pages/Admin/EmployeeExcelUpload';
import ListEmployees from './pages/Admin/ListEmployees';
import Reports from './pages/Admin/Reports';
import ReviewEmployeeGoal from './pages/manager/ReviewEmployeeGoal';
import TeamManagement from './pages/manager/TeamManagement'; 
import CFOAllUsersGoals from './pages/cfo/CFOAllUsersGoals';
import Notifications from './pages/Notifications/Notifications';
import {ToastContainer} from 'react-toastify';

function App() {
  return ( 
    <AuthProvider>
    <ToastContainer />
      <Router>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/force-reset-password" element={<ForceResetPassword />} />

          {/* Public Goal Review Route (Accessible from Email Links with token)[cite: 1] */}
          <Route path="/goals/review" element={<GoalReview />} />
          
          {/* Protected Layout Routes Wrapped with ProtectedRoute Guard */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/goals" element={<ListGoal />} />
              <Route path="/goals/add" element={<AddGoal />} />
              <Route path="/goals/edit/:id" element={<EditGoal />} />
              <Route path="/goals/view/:id" element={<ViewGoal />} />
              <Route path="/goals/quarterly-update/:id" element={<QuarterlyUpdate />} />
              <Route path="/goals/final-evaluation" element={<FinalEvaluation />} />
              <Route path="/goals/final-evaluation/:userId" element={<FinalEvaluation />} />
              <Route path="/admin/add-employees" element={<AddEmployees />} />
              <Route path="/admin/upload-excel" element={<EmployeeExcelUpload />} />
              <Route path="/admin/employees-list" element={<ListEmployees />} />
              <Route path="/admin/reports" element={<Reports />} />
              
              {/* Manager, HOD, and BusinessHead Team Goal Review & Approval Routes[cite: 1] */}
              
              {/* Team Management & Employee Goals Table View Routes */}
              <Route path="/manager/team-management" element={<TeamManagement />} />
              <Route path="/manager/review-employee-goal" element={<ReviewEmployeeGoal />} />
              
              {/* CFO Route */}
              <Route path="/cfo/all-goals" element={<CFOAllUsersGoals />} />

              <Route path="/setting" element={<Setting />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/change-password" element={<ChangePassword />} /> {/* <-- ૨. આ રાઉટ અહી એડ કરો */}
              {/* NOTE: this page/component already existed but had no route
                  registered anywhere, so it was unreachable. Added so the
                  notification bell's "View All" link has somewhere to go. */}
              <Route path="/notifications" element={<Notifications />} />
              
            </Route>
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;