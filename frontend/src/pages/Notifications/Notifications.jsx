import React, { useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
  Tooltip,
} from "@mui/material";

import Grid from "@mui/material/Grid";

import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import NotificationsIcon from "@mui/icons-material/Notifications";

import EmptyState from "../../components/EmptyState/EmptyState";

import { useDispatch, useSelector } from "react-redux";

import {
  fetchNotifications,
  markAsRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
} from "../../redux/slices/notificationSlice";

const Notifications = () => {
  const dispatch = useDispatch();

  const { notifications, loading } = useSelector((state) => state.notification);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  const handleRead = (id) => {
    dispatch(markAsRead(id));
  };

  const handleDelete = (id) => {
    dispatch(deleteNotification(id));
  };

  const handleReadAll = () => {
    dispatch(markAllRead());
  };

  const handleDeleteAll = () => {
    dispatch(deleteAllNotifications());
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 bg-slate-100 min-h-screen text-slate-900">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-5 rounded-xl shadow-sm border border-slate-300">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Notifications
          </h1>
          <p className="text-sm font-medium text-slate-600 mt-1">
            Manage your alerts and task updates
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleReadAll}
            disabled={loading || notifications.length === 0}
            className="flex items-center gap-2 px-4 py-2 font-bold text-sm text-slate-800 bg-slate-100 border-2 border-slate-300 rounded-lg hover:bg-slate-200 active:bg-slate-300 disabled:opacity-40 transition-all cursor-pointer"
          >
            <MarkEmailReadIcon className="text-emerald-700" />
            Mark All Read
          </button>

          <button
            onClick={handleDeleteAll}
            disabled={loading || notifications.length === 0}
            className="flex items-center gap-2 px-4 py-2 font-bold text-sm text-red-700 bg-red-100 border-2 border-red-300 rounded-lg hover:bg-red-200 active:bg-red-300 disabled:opacity-40 transition-all cursor-pointer"
          >
            <DeleteSweepIcon />
            Delete All
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-12 h-12 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center text-center p-12 bg-white rounded-xl border-2 border-dashed border-slate-300 shadow-sm">
          <div className="p-4 bg-slate-100 rounded-full text-slate-600 mb-3">
            <NotificationsIcon style={{ fontSize: 48 }} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            No notifications yet
          </h2>
          <p className="text-slate-600 font-medium max-w-sm mt-1">
            You're all caught up! New updates on your goals and approvals will
            show up here.
          </p>
        </div>
      ) : (
        /* Notifications List */
        <div className="space-y-4">
          {notifications.map((item) => (
            <div
              key={item.NotificationId}
              className={`flex justify-between items-start gap-4 p-5 rounded-xl border-2 shadow-sm transition-all ${
                item.IsRead
                  ? "bg-slate-50 border-slate-300 opacity-90"
                  : "bg-white border-amber-400 border-l-8 border-l-amber-500 shadow-md"
              }`}
            >
              {/* Card Content */}
              <div className="flex-1 space-y-2">
                <h2 className="text-lg font-extrabold text-slate-900 leading-snug">
                  {item.Title}
                </h2>

                <p className="text-base font-normal text-slate-800 leading-relaxed">
                  {item.Message}
                </p>

                {/* Status Badges & Date */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <span className="px-3 py-1 font-bold text-xs uppercase tracking-wider bg-blue-100 text-blue-900 rounded-md border border-blue-300">
                    {item.NotificationType}
                  </span>

                  <span
                    className={`px-3 py-1 font-bold text-xs uppercase tracking-wider rounded-md border ${
                      item.IsRead
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                        : "bg-amber-100 text-amber-900 border-amber-300"
                    }`}
                  >
                    {item.IsRead ? "Read" : "Unread"}
                  </span>

                  <span className="text-xs font-bold text-slate-500">
                    {new Date(item.CreatedAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                {!item.IsRead && (
                  <button
                    title="Mark As Read"
                    onClick={() => handleRead(item.NotificationId)}
                    className="p-2 text-emerald-700 hover:bg-emerald-200 rounded-md transition-colors cursor-pointer"
                  >
                    <MarkEmailReadIcon />
                  </button>
                )}

                <button
                  title="Delete"
                  onClick={() => handleDelete(item.NotificationId)}
                  className="p-2 text-red-700 hover:bg-red-200 rounded-md transition-colors cursor-pointer"
                >
                  <DeleteIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
