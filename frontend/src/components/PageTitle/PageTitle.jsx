import React, { useMemo } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useLocation } from "react-router-dom";

import routeConfig from "../../routes/routeConfig";

/**
 * ============================================================
 * Goal Tracker Management System
 * Page Title Component
 * ============================================================
 */

const DEFAULT_TITLE = "Dashboard";

const PageTitle = ({
  title,
  subtitle,
  actions,
}) => {
  const location = useLocation();

  const route = useMemo(() => {
    return routeConfig.find(
      (item) => item.path === location.pathname
    );
  }, [location.pathname]);

  const pageTitle =
    title ||
    route?.title ||
    DEFAULT_TITLE;

  const pageSubtitle =
    subtitle ||
    route?.description ||
    "";

  return (
    <Box
      sx={{
        mb: 3,
      }}
    >
      <Stack
        direction={{
          xs: "column",
          sm: "row",
        }}
        justifyContent="space-between"
        alignItems={{
          xs: "flex-start",
          sm: "center",
        }}
        spacing={2}
      >
        {/* Title Section */}
        <Box>
          <Typography
            variant="h4"
            fontWeight={700}
            color="text.primary"
          >
            {pageTitle}
          </Typography>

          {pageSubtitle && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.5,
              }}
            >
              {pageSubtitle}
            </Typography>
          )}
        </Box>

        {/* Action Section */}
        {actions && (
          <Box>
            {actions}
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default PageTitle;