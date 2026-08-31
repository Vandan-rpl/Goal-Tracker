import React from 'react';
import { Outlet } from 'react-router-dom';
import { Toolbar } from '@mui/material';
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
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/*
          NOTE: this used to be a plain inline <header> div with no
          notification bell at all. Swapped in the real <Header /> component
          (src/components/Header/Header.jsx), which already had the
          notifications bell, badge, and profile menu built — it just
          wasn't rendered anywhere in the app. Header uses a fixed MUI
          AppBar, so a spacer <Toolbar /> below it pushes page content down
          by the same height instead of the AppBar overlapping it.
        */}
        <Header />
        <Toolbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
