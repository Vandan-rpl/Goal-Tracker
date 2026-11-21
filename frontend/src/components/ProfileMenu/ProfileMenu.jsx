import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { Avatar, Divider, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";

import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";

import { logout as logoutRedux } from "../../redux/slices/authSlice";
import useAuth from "../../hooks/useAuth";

const ROLE_LABELS = {
  BUSINESSHEAD: "CFO",
  HOD: "HOD",
  MANAGER: "Manager",
  ADMIN: "Administrator",
  EMPLOYEE: "Employee",
};

const initialsOf = (name) =>
  !name || name === "User"
    ? "U"
    : name
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0))
        .join("")
        .substring(0, 2)
        .toUpperCase();

/**
 * Profile card at the bottom of the sidebar: avatar, name and designation
 * (click for Profile / Settings) with the Logout button inside the card.
 * `compact` (collapsed sidebar) shows only the avatar, which opens the same
 * menu.
 */
const ProfileMenu = ({ compact = false }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);

  const displayName = user?.fullName || user?.FullName || "User";
  const role = String(user?.role || user?.Role || "").toUpperCase();
  const email = user?.email || user?.Email || "";

  const handleClose = () => setAnchorEl(null);

  const handleNavigate = (path) => {
    handleClose();
    navigate(path);
  };

  const handleLogout = () => {
    handleClose();
    logout();
    dispatch(logoutRedux());
    sessionStorage.removeItem("token");
    navigate("/login", { replace: true });
  };

  return (
    <div className={compact ? "flex justify-center" : "rounded-xl border border-white/15 bg-white/10 p-2"}>
      <button
        type="button"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
        aria-label={compact ? displayName : undefined}
        title={compact ? displayName : undefined}
        className={`flex items-center rounded-lg text-left transition-colors hover:bg-white/10 cursor-pointer ${
          compact ? "p-1" : "w-full gap-3 p-1.5"
        }`}
      >
        <Avatar
          src={user?.profileImage || ""}
          alt={displayName}
          sx={{
            width: 36,
            height: 36,
            fontSize: 13,
            fontWeight: 700,
            bgcolor: "#ffffff",
            color: "#2c3e82",
          }}
        >
          {!user?.profileImage && initialsOf(displayName)}
        </Avatar>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{displayName}</span>
            </span>
            <UnfoldMoreIcon sx={{ fontSize: 18, color: "rgba(199, 210, 254, 0.8)" }} />
          </>
        )}
      </button>

      {!compact && (
      <button
        type="button"
        onClick={handleLogout}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-white transition-all duration-200 hover:border-rose-500 hover:bg-rose-500 cursor-pointer"
      >
        <svg className="h-4 w-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Logout
      </button>
      )}

      {/* Opens upward, above the card. */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { width: 240, mb: 1, borderRadius: 2 } } }}
      >
        <div className="px-4 py-2.5">
          <p className="text-sm font-semibold text-slate-900">{displayName}</p>
          {email && <p className="mt-0.5 truncate text-xs text-slate-500">{email}</p>}
        </div>
        <Divider />
        <MenuItem onClick={() => handleNavigate("/profile")}>
          <ListItemIcon>
            <PersonOutlineOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleNavigate("/setting")}>
          <ListItemIcon>
            <SettingsOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>
      </Menu>
    </div>
  );
};

export default ProfileMenu;
