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
            slotProps={{
              paper: {
                elevation: 4,
                sx: {
                  width: 310,
                  maxWidth: "92vw",
                  mt: 1,
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  boxShadow: "0 10px 20px -3px rgba(0, 0, 0, 0.08)",
                },
              },
            }}
          >
            {/* Header */}
            <Box
              sx={{
                px: 2,
                py: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #e2e8f0",
                bgcolor: "#ffffff",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#1e293b",
                  letterSpacing: "0.02em",
                }}
              >
                Notifications
              </span>
              {notificationCount > 0 && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#1d4ed8",
                    backgroundColor: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  {notificationCount} new
                </span>
              )}
            </Box>

            {/* Empty State */}
            {latestFive.length === 0 && (
              <Box sx={{ px: 2, py: 4, textAlign: "center" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  You're all caught up! No notifications.
                </span>
              </Box>
            )}

            {/* Notification List Items */}
            {latestFive.map((item, index) => (
              <MenuItem
                key={item.NotificationId}
                onClick={handleNotifClose}
                disableRipple
                sx={{
                  px: 2,
                  py: 1.25,
                  minHeight: "unset",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.5,
                  backgroundColor: item.IsRead ? "#ffffff" : "#f8fafc",
                  borderBottom:
                    index < latestFive.length - 1
                      ? "1px solid #f1f5f9"
                      : "none",
                  "&:hover": {
                    backgroundColor: item.IsRead ? "#f8fafc" : "#f1f5f9",
                  },
                }}
              >
                {/* Unread Dot Indicator */}
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    marginTop: "5px",
                    flexShrink: 0,
                    backgroundColor: item.IsRead ? "transparent" : "#2563eb",
                  }}
                />

                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      lineHeight: "1.3",
                      fontWeight: item.IsRead ? 500 : 700,
                      color: "#0f172a",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.Title}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      marginTop: "2px",
                      fontSize: "12px",
                      lineHeight: "1.3",
                      color: "#64748b",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.Message}
                  </p>
                </div>
              </MenuItem>
            ))}

            {/* Footer */}
            <MenuItem
              onClick={handleViewAll}
              disableRipple
              sx={{
                justifyContent: "center",
                py: 1.25,
                minHeight: "unset",
                backgroundColor: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                "&:hover": { backgroundColor: "#f1f5f9" },
              }}
            >
              <span
                style={{ fontSize: "12px", fontWeight: 600, color: "#2563eb" }}
              >
                View all notifications &rarr;
              </span>
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
