import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import {
  AppBar,
  Badge,
  Box,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";

import { toggleMobile, toggleSidebar } from "../../redux/slices/sidebarSlice";

import {
  fetchNotifications,
  fetchNotificationCount,
} from "../../redux/slices/notificationSlice";

import { formatTime, formatLongDate, getGreeting } from "../../utils/dateTime";

import ProfileMenu from "../ProfileMenu/ProfileMenu";
import CircleIcon from "@mui/icons-material/Circle";

const Header = ({ drawerWidth = 260 }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const theme = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { collapsed } = useSelector((state) => state.sidebar);

  const { user } = useSelector((state) => state.auth);

  const currentUser = useMemo(() => {
    if (user) return user;

    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "null");
      return storedUser || null;
    } catch {
      return null;
    }
  }, [user]);

  const displayName = useMemo(() => {
    if (!currentUser) return "User";

    return (
      currentUser.fullName ||
      currentUser.FullName ||
      [
        currentUser.firstName || currentUser.FirstName,
        currentUser.lastName || currentUser.LastName,
      ]
        .filter(Boolean)
        .join(" ") ||
      currentUser.username ||
      currentUser.Username ||
      "User"
    );
  }, [currentUser]);

  // Real unread count + notification list, replacing the old hardcoded
  // badgeContent={0}. notificationCount is kept live afterwards by
  // notificationReceived (see notificationSlice.js), which useSocket.js
  // dispatches whenever a 'notification:new' socket event arrives.
  const { notifications, notificationCount } = useSelector(
    (state) => state.notification,
  );

  const [currentTime, setCurrentTime] = useState(formatTime());

  const [currentDate, setCurrentDate] = useState(formatLongDate());

  const [greeting, setGreeting] = useState(getGreeting());

  const [notifAnchorEl, setNotifAnchorEl] = useState(null);
  const notifMenuOpen = Boolean(notifAnchorEl);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatTime());
      setCurrentDate(formatLongDate());
      setGreeting(getGreeting());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch the real count + list once on mount. After this, notificationCount
  // stays current via the socket-driven notificationReceived action, and
  // markAsRead/markAllRead/delete thunks already keep it in sync elsewhere.
  useEffect(() => {
    dispatch(fetchNotificationCount());
    dispatch(fetchNotifications());
  }, [dispatch]);

  const handleMenuClick = () => {
    if (isMobile) {
      dispatch(toggleMobile());
    } else {
      dispatch(toggleSidebar());
    }
  };

  const handleNotifOpen = (event) => {
    setNotifAnchorEl(event.currentTarget);
  };

  const handleNotifClose = () => {
    setNotifAnchorEl(null);
  };

  const handleViewAll = () => {
    handleNotifClose();
    navigate("/notifications");
  };

  const latestFive = notifications.slice(0, 5);

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        width: {
          md: `calc(100% - ${collapsed ? 72 : drawerWidth}px)`,
        },
        ml: {
          md: `${collapsed ? 72 : drawerWidth}px`,
        },
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        zIndex: theme.zIndex.drawer + 1,
        transition: theme.transitions.create(["width", "margin"], {
          easing: theme.transitions.easing.easeInOut,
          duration: theme.transitions.duration.standard,
        }),
      }}
    >
      <Toolbar>
        {/* Sidebar Toggle */}
        <IconButton
          edge="start"
          color="inherit"
          onClick={handleMenuClick}
          sx={{ mr: 2 }}
        >
          {collapsed ? <MenuIcon /> : <MenuOpenIcon />}
        </IconButton>

        {/* Greeting */}
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" fontWeight={600}>
            {greeting}, {displayName}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            {currentDate}
            {" • "}
            {currentTime}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          {/* Theme Toggle (Placeholder) */}
          {/* <Tooltip title="Theme">
            <IconButton color="inherit">
              {theme.palette.mode === "dark" ? (
                <LightModeOutlinedIcon />
              ) : (
                <DarkModeOutlinedIcon />
              )}
            </IconButton>
          </Tooltip> */}

          {/* Notifications */}
          <Tooltip title="Notifications">
            <IconButton color="inherit" onClick={handleNotifOpen}>
              <Badge badgeContent={notificationCount} color="error" max={99}>
                <NotificationsOutlinedIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={notifAnchorEl}
            open={notifMenuOpen}
            onClose={handleNotifClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            SlotProps={{
              paper: {
                className:
                  "w-[360px] max-w-[92vw] mt-2 rounded-xl border border-slate-300 shadow-2xl overflow-hidden bg-white text-slate-900",
              },
            }}
          >
            {/* Header */}
            <Box className="px-4 py-3 flex items-center justify-between bg-slate-50 border-b border-slate-200">
              <Typography className="text-base font-extrabold text-slate-900">
                Notifications
              </Typography>
              {notificationCount > 0 && (
                <Typography className="px-2.5 py-0.5 text-xs font-extrabold text-blue-900 bg-blue-100 border border-blue-300 rounded-full">
                  {notificationCount} unread
                </Typography>
              )}
            </Box>

            {/* Empty State */}
            {latestFive.length === 0 && (
              <Box className="px-4 py-8 text-center bg-white">
                <Typography className="text-sm font-semibold text-slate-600">
                  You're all caught up — no notifications yet.
                </Typography>
              </Box>
            )}

            {/* Notification List Items */}
            {latestFive.map((item, index) => (
              <MenuItem
                key={item.NotificationId}
                onClick={handleNotifClose}
                className={`px-4 py-3 flex items-start gap-3 transition-colors ${
                  item.IsRead
                    ? "bg-white hover:bg-slate-100"
                    : "bg-blue-50/70 hover:bg-blue-100/80"
                } ${index < latestFive.length - 1 ? "border-b border-slate-200" : ""}`}
              >
                {/* Unread Indicator Dot */}
                <CircleIcon
                  className={`text-[10px] mt-1 flex-shrink-0 ${
                    item.IsRead ? "text-transparent" : "text-blue-600"
                  }`}
                />

                <Box className="min-w-0 flex-1">
                  <Typography
                    className={`text-sm leading-snug truncate ${
                      item.IsRead
                        ? "font-semibold text-slate-800"
                        : "font-extrabold text-slate-950"
                    }`}
                  >
                    {item.Title}
                  </Typography>
                  <Typography className="text-xs font-medium text-slate-600 truncate mt-0.5">
                    {item.Message}
                  </Typography>
                </Box>
              </MenuItem>
            ))}

            {/* Footer */}
            <Divider className="border-slate-200" />
            <MenuItem
              onClick={handleViewAll}
              className="justify-center py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <Typography className="text-sm font-extrabold text-blue-700 hover:text-blue-900">
                View all notifications
              </Typography>
            </MenuItem>
          </Menu>

          <Divider
            orientation="vertical"
            flexItem
            sx={{
              mx: 1,
            }}
          />

          {/* Profile */}
          <ProfileMenu />
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
