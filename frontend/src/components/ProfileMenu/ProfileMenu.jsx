import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";

import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";

/**
 * Update this import according to your authSlice.
 * Example:
 * import { logout } from "../../redux/slices/authSlice";
 */
import { logout } from "../../redux/slices/authSlice";

const ProfileMenu = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user } = useSelector((state) => state.auth);

  const currentUser = user || (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

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

  const [anchorEl, setAnchorEl] = useState(null);

  const open = Boolean(anchorEl);

  const initials = useMemo(() => {
    if (!displayName || displayName === "User") return "U";

    return displayName
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }, [displayName]);

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNavigate = (path) => {
    handleClose();
    navigate(path);
  };

  const handleLogout = () => {
    handleClose();

    dispatch(logout());

    localStorage.removeItem("token");
    sessionStorage.removeItem("token");

    navigate("/login", {
      replace: true,
    });
  };

  return (
    <>
      <IconButton
        onClick={handleOpen}
        size="small"
        color="inherit"
      >
        <Avatar
          src={currentUser?.profileImage || ""}
          alt={displayName}
          sx={{
            width: 40,
            height: 40,
            bgcolor: "primary.main",
            fontWeight: 600,
          }}
        >
          {!currentUser?.profileImage && initials}
        </Avatar>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        keepMounted
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        PaperProps={{
          sx: {
            width: 300,
            mt: 1,
            borderRadius: 2,
          },
        }}
      >
        {/* User Information */}
        <Box
          sx={{
            px: 2,
            py: 2,
          }}
        >
          <Typography
            variant="subtitle1"
            fontWeight={600}
          >
            {displayName}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            {currentUser?.designation || ""}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            {currentUser?.department || ""}
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
          >
            {currentUser?.email || ""}
          </Typography>
        </Box>

        <Divider />

        {/* Profile */}
        <MenuItem
          onClick={() =>
            handleNavigate("/profile")
          }
        >
          <ListItemIcon>
            <PersonOutlineOutlinedIcon
              fontSize="small"
            />
          </ListItemIcon>

          <ListItemText>
            Profile
          </ListItemText>
        </MenuItem>

        {/* Settings */}
        <MenuItem
          onClick={() =>
            handleNavigate("/settings")
          }
        >
          <ListItemIcon>
            <SettingsOutlinedIcon
              fontSize="small"
            />
          </ListItemIcon>

          <ListItemText>
            Settings
          </ListItemText>
        </MenuItem>

        <Divider />

        {/* Logout */}
        <MenuItem
          onClick={handleLogout}
        >
          <ListItemIcon>
            <LogoutOutlinedIcon
              color="error"
              fontSize="small"
            />
          </ListItemIcon>

          <ListItemText
            primaryTypographyProps={{
              color: "error",
            }}
          >
            Logout
          </ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default ProfileMenu;