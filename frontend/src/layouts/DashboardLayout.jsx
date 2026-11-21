import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from '../components/Header/Header';
import useSocket from '../hooks/useSocket';

const DashboardLayout = () => {
  // Connects the single Socket.IO connection for the whole authenticated
  // session right here, since this layout mounts once and stays mounted
  // across all nested route navigation (only <Outlet/>'s children change).
  // See src/hooks/useSocket.js.
  useSocket();

  return (
    // Full-width header on top (portal branding, module switch, bell,
    // profile); the sidebar and the page sit below it.
    <div className="flex flex-col h-screen bg-gray-100">
      <Header />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
