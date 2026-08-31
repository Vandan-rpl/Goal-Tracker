import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const DashboardLayout = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm h-16 flex items-center px-6 justify-between border-b">
          <h1 className="text-lg font-semibold text-gray-800">Goal & Performance Tracking</h1>
          <span className="text-sm text-gray-600">Welcome back</span>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout; // Ensure this line exists