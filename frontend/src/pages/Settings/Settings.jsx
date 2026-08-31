import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Divider,
  Switch,
  FormControlLabel,
  Button,
  Stack,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";

import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import NotificationsIcon from "@mui/icons-material/Notifications";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LogoutIcon from "@mui/icons-material/Logout";
import ComputerIcon from "@mui/icons-material/Computer";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

import { useNavigate } from "react-router-dom";

const Settings = () => {
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(false);

  const [emailNotification, setEmailNotification] = useState(true);

  const [browserNotification, setBrowserNotification] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login");
  };

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight="bold" mb={3}>
        Settings
      </Typography>

      <Grid container spacing={3}>
        {/* Account */}

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account
              </Typography>

              <Divider sx={{ mb: 2 }} />

              <List>
                <ListItem button onClick={() => navigate("/profile")}>
                  <ListItemIcon>
                    <PersonIcon />
                  </ListItemIcon>

                  <ListItemText
                    primary="Profile"
                    secondary="View and update your profile"
                  />

                  <ArrowForwardIosIcon fontSize="small" />
                </ListItem>

                <ListItem button onClick={() => navigate("/change-password")}>
                  <ListItemIcon>
                    <LockIcon />
                  </ListItemIcon>

                  <ListItemText
                    primary="Change Password"
                    secondary="Update your account password"
                  />

                  <ArrowForwardIosIcon fontSize="small" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Preferences */}

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Preferences
              </Typography>

              <Divider sx={{ mb: 2 }} />

              <Stack spacing={2}>
                {/* Theme toggle button */}
                {/* <FormControlLabel
                  control={
                    <Switch
                      checked={darkMode}
                      onChange={() => setDarkMode(!darkMode)}
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center">
                      <DarkModeIcon sx={{ mr: 1 }} />
                      Dark Mode
                    </Box>
                  }
                /> */}

                <FormControlLabel
                  control={
                    <Switch
                      checked={emailNotification}
                      onChange={() => setEmailNotification(!emailNotification)}
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center">
                      <NotificationsIcon sx={{ mr: 1 }} />
                      Email Notifications
                    </Box>
                  }
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={browserNotification}
                      onChange={() =>
                        setBrowserNotification(!browserNotification)
                      }
                    />
                  }
                  label="Browser Notifications"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;
