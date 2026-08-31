import React from "react";
import {
  Box,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

/**
 * ============================================================
 * Goal Tracker Management System
 * Footer
 * ============================================================
 */

const APP_NAME =
  import.meta.env.VITE_APP_NAME ||
  "Goal Tracker Management System";

const APP_VERSION =
  import.meta.env.VITE_APP_VERSION ||
  "v1.0.0";

const APP_ENV =
  import.meta.env.VITE_APP_ENV ||
  "Development";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const getEnvironmentColor = () => {
    switch (APP_ENV.toLowerCase()) {
      case "production":
        return "success";

      case "uat":
        return "warning";

      case "staging":
        return "info";

      case "development":
      default:
        return "default";
    }
  };

  return (
    <Box
      component="footer"
      sx={{
        mt: "auto",
        borderTop: (theme) =>
          `1px solid ${theme.palette.divider}`,
        backgroundColor: "background.paper",
      }}
    >
      <Divider />

      <Stack
        direction={{
          xs: "column",
          md: "row",
        }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{
          xs: "center",
          md: "center",
        }}
        sx={{
          px: 3,
          py: 2,
        }}
      >
        {/* Left Section */}
        <Box
          textAlign={{
            xs: "center",
            md: "left",
          }}
        >
          <Typography
            variant="body2"
            color="text.primary"
            fontWeight={600}
          >
            {APP_NAME}
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
          >
            © {currentYear} {APP_NAME}. All rights reserved.
          </Typography>
        </Box>

        {/* Right Section */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          justifyContent="center"
        >
          <Chip
            label={APP_VERSION}
            size="small"
            variant="outlined"
          />

          <Chip
            label={APP_ENV}
            size="small"
            color={getEnvironmentColor()}
            variant="filled"
          />
        </Stack>
      </Stack>
    </Box>
  );
};

export default Footer;