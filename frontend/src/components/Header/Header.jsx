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
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";

import {
  toggleMobile,
  toggleSidebar,
} from "../../redux/slices/sidebarSlice";

import {
  fetchNotifications,
  fetchNotificationCount,
} from "../../redux/slices/notificationSlice";

import {
  formatTime,
  formatLongDate,
  getGreeting,
} from "../../utils/dateTime";

import ProfileMenu from "../ProfileMenu/ProfileMenu";
import CircleIcon from "@mui/icons-material/Circle";

const Header = ({ drawerWidth = 260 }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const theme = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { collapsed } = useSelector(
    (state) => state.sidebar
  );

  const { user } = useSelector(
    (state) => state.auth
  );

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
      [currentUser.firstName || currentUser.FirstName, currentUser.lastName || currentUser.LastName]
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
    (state) => state.notification
  );

  const [currentTime, setCurrentTime] = useState(
    formatTime()
  );

  const [currentDate, setCurrentDate] = useState(
    formatLongDate()
  );

  const [greeting, setGreeting] = useState(
    getGreeting()
  );

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
          md: `calc(100% - ${
            collapsed ? 72 : drawerWidth
          }px)`,
        },
        ml: {
          md: `${collapsed ? 72 : drawerWidth}px`,
        },
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        zIndex: theme.zIndex.drawer + 1,
        transition: theme.transitions.create(
          ["width", "margin"],
          {
            easing: theme.transitions.easing.easeInOut,
            duration: theme.transitions.duration.standard,
          }
        ),
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
          {collapsed ? (
            <MenuIcon />
          ) : (
            <MenuOpenIcon />
          )}
        </IconButton>

        {/* Greeting */}
        <Box sx={{ flexGrow: 1 }}>
          <Typography
            variant="h6"
            fontWeight={600}
          >
            {greeting}, {displayName}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            {currentDate}
            {" • "}
            {currentTime}
          </Typography>
        </Box>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
        >
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
              <Badge
                badgeContent={notificationCount}
                color="error"
                max={99}
              >
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
            PaperProps={{
              sx: {
                width: 360,
                maxWidth: "92vw",
                mt: 1,
                borderRadius: 2,
                boxShadow: "0 8px 24px rgba(20,23,31,0.12)",
              },
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography variant="subtitle1" fontWeight={700}>
                Notifications
              </Typography>
              {notificationCount > 0 && (
                <Typography variant="caption" fontWeight={700} color="primary.main">
                  {notificationCount} unread
                </Typography>
              )}
            </Box>
            <Divider />

            {latestFive.length === 0 && (
              <Box sx={{ px: 2, py: 3, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  You're all caught up — no notifications yet.
                </Typography>
              </Box>
            )}

            {latestFive.map((item, index) => (
              <MenuItem
                key={item.NotificationId}
                onClick={handleNotifClose}
                sx={{
                  whiteSpace: "normal",
                  alignItems: "flex-start",
                  gap: 1,
                  py: 1.25,
                  px: 2,
                  borderBottom:
                    index < latestFive.length - 1 ? "1px solid" : "none",
                  borderColor: "divider",
                  bgcolor: item.IsRead ? "transparent" : "primary.lighter",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                {/* Unread indicator dot, replacing the flat opacity toggle
                    with something that actually reads as "new" at a glance */}
                <CircleIcon
                  sx={{
                    fontSize: 8,
                    mt: 0.75,
                    color: item.IsRead ? "transparent" : "primary.main",
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight={item.IsRead ? 500 : 700}
                    noWrap
                  >
                    {item.Title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.Message}
                  </Typography>
                </Box>
              </MenuItem>
            ))}

            <Divider />
            <MenuItem onClick={handleViewAll} sx={{ justifyContent: "center", py: 1.25 }}>
              <Typography variant="body2" color="primary.main" fontWeight={700}>
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
