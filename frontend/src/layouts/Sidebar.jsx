import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Force checking role string (handling both uppercase and lowercase)
  const role = (user?.Role || user?.role || '').toUpperCase();
  const isManagerOrHOD = ['HOD', 'MANAGER', 'BUSINESSHEAD', 'ADMIN'].includes(role);

  // Debug log to check user role in console
  console.log("Current User Role:", user?.Role);

  return (
    <aside className="w-64 bg-slate-800 text-slate-300 flex flex-col h-screen">
      <div className="p-5 text-xl font-bold text-white border-b border-slate-700">
        Goal Tracker
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <Link to="/dashboard" className="block px-4 py-2.5 rounded hover:bg-slate-700 hover:text-white transition">
          Dashboard
        </Link>
        <Link to="/goals" className="block px-4 py-2.5 rounded hover:bg-slate-700 hover:text-white transition">
          Goal Management
        </Link>

        {/* FORCE RENDERING FOR HOD, MANAGER, & BUSINESS HEAD */}
        {isManagerOrHOD && (
          <div className="pt-4 pb-2 mt-2 border-t border-slate-700">
            <p className="px-4 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              {role === 'BUSINESSHEAD' ? 'Business Head View' : 'Team Management'}
            </p>
            <Link 
              to="/manager/team-management" 
              className="block px-4 py-2.5 mt-1 rounded hover:bg-slate-700 hover:text-white transition"
            >
              Team Management
            </Link>
            <Link
              to="/admin/reports"
              className="block px-4 py-2.5 mt-1 rounded hover:bg-slate-700 hover:text-white transition"
            >
              Reports & Analytics
            </Link>
          </div>
        )}

        {role === 'ADMIN' && (
          <div className="pt-4 pb-2 mt-2 border-t border-slate-700">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Administration</p>
            <Link to="/admin/employees-list" className="block px-4 py-2.5 mt-1 rounded hover:bg-slate-700 hover:text-white transition">
              List Employees
            </Link>
            <Link to="/admin/add-employees" className="block px-4 py-2.5 mt-1 rounded hover:bg-slate-700 hover:text-white transition">
              Add Employees
            </Link>
            <Link to="/admin/upload-excel" className="block px-4 py-2.5 mt-1 rounded hover:bg-slate-700 hover:text-white transition">
              Upload Employees Excel
            </Link>
            <Link to="/admin/reports" className="block px-4 py-2.5 mt-1 rounded hover:bg-slate-700 hover:text-white transition">
              Reports & Analytics
            </Link>
          </div>
        )}

        <Link to="/profile" className="block px-4 py-2.5 rounded hover:bg-slate-700 hover:text-white transition">
          Profile
        </Link>
        <Link to="/setting" className="block px-4 py-2.5 rounded hover:bg-slate-700 hover:text-white transition">
          Setting
        </Link>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <button 
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded transition text-center text-sm font-medium"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;