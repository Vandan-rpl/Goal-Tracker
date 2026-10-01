import React, { useEffect } from "react";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import NotificationsIcon from "@mui/icons-material/Notifications";

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

  const handleRead = (id) => dispatch(markAsRead(id));
  const handleDelete = (id) => dispatch(deleteNotification(id));
  const handleReadAll = () => dispatch(markAllRead());
  const handleDeleteAll = () => dispatch(deleteAllNotifications());

  const unreadCount = notifications.filter((n) => !n.IsRead).length;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4 bg-white min-h-screen text-slate-800">
      
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
            disabled={loading || notifications.length === 0 || unreadCount === 0}
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
                item.IsRead
                  ? "bg-white border-slate-200 hover:border-slate-300"
                  : "bg-blue-50/30 border-blue-200 border-l-4 border-l-blue-600 shadow-xs"
              }`}
            >
              {/* Card Main Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  {!item.IsRead && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  )}
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {item.Title}
                  </h3>
                </div>

                <p className="text-xs text-slate-600 leading-normal line-clamp-2">
                  {item.Message}
                </p>

                {/* Metadata Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-slate-100 text-slate-600 rounded border border-slate-200">
                    {item.NotificationType}
                  </span>

                  <span className="text-[11px] text-slate-400 font-medium">
                    &bull;
                  </span>

                  <span className="text-[11px] text-slate-400 font-medium">
                    {new Date(item.CreatedAt).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
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