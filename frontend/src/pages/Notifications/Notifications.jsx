import React, { useEffect, useState } from "react";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import NotificationsIcon from "@mui/icons-material/Notifications";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import {
  fetchNotifications,
  markAsRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
} from "../../redux/slices/notificationSlice";
import { formatServerDateTime } from "../../utils/dateTime";

const Notifications = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { notifications, loading } = useSelector((state) => state.notification);

  // Back to the previous page; opened directly (no in-app history), go to the dashboard.
  const handleBack = () => {
    if (location.key === "default") navigate("/dashboard");
    else navigate(-1);
  };

  // Notifications that were unread when the page opened: still highlighted
  // as "new" for this visit, although they are marked read straight away.
  const [newIds, setNewIds] = useState(() => new Set());

  // Opening this page marks every notification as read, so the header
  // badge count is cleared when the user goes back.
  useEffect(() => {
    let cancelled = false;
    dispatch(fetchNotifications()).then((action) => {
      if (cancelled || !Array.isArray(action.payload)) return;
      const unread = action.payload.filter((n) => !n.IsRead).map((n) => n.NotificationId);
      setNewIds(new Set(unread));
      if (unread.length > 0) dispatch(markAllRead());
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const handleRead = (id) => dispatch(markAsRead(id));
  const handleDelete = (id) => dispatch(deleteNotification(id));
  const handleReadAll = () => dispatch(markAllRead());
  const handleDeleteAll = () => dispatch(deleteAllNotifications());

  const isNew = (item) => !item.IsRead || newIds.has(item.NotificationId);
  const unreadCount = notifications.filter(isNew).length;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4 bg-white min-h-screen text-slate-800">
      
      <button
        onClick={handleBack}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
      >
        <ArrowBackIcon style={{ fontSize: 16 }} />
        Back
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your alerts and task updates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReadAll}
            disabled={loading || !notifications.some((n) => !n.IsRead)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
          >
            <MarkEmailReadIcon className="text-emerald-600" style={{ fontSize: 16 }} />
            Mark All Read
          </button>

          <button
            onClick={handleDeleteAll}
            disabled={loading || notifications.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-slate-300 hover:bg-red-50 hover:border-red-200 active:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
          >
            <DeleteSweepIcon style={{ fontSize: 16 }} />
            Clear All
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        
        /* Empty State */
        <div className="flex flex-col items-center justify-center text-center py-12 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          <div className="p-3 bg-white rounded-full text-slate-400 shadow-sm border border-slate-100 mb-2">
            <NotificationsIcon style={{ fontSize: 28 }} />
          </div>
          <h2 className="text-sm font-semibold text-slate-800">
            No notifications yet
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
            You're all caught up! Updates regarding your goals and approvals will appear here.
          </p>
        </div>
      ) : (
        
        /* Notifications List */
        <div className="space-y-2.5">
          {notifications.map((item) => (
            <div
              key={item.NotificationId}
              className={`group flex items-start justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                !isNew(item)
                  ? "bg-white border-slate-200 hover:border-slate-300"
                  : "bg-blue-50/30 border-blue-200 border-l-4 border-l-blue-600 shadow-xs"
              }`}
            >
              {/* Card Main Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  {isNew(item) && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  )}
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {item.Title}
                  </h3>
                </div>

                <p className="text-xs text-slate-600 leading-normal line-clamp-2">
                  {item.Message}
                </p>

                <p className="pt-1 text-[11px] text-slate-400 font-medium">
                  {formatServerDateTime(item.CreatedAt)}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
                {!item.IsRead && (
                  <button
                    title="Mark as read"
                    onClick={() => handleRead(item.NotificationId)}
                    className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <MarkEmailReadIcon style={{ fontSize: 18 }} />
                  </button>
                )}

                <button
                  title="Delete"
                  onClick={() => handleDelete(item.NotificationId)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <DeleteIcon style={{ fontSize: 18 }} />
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