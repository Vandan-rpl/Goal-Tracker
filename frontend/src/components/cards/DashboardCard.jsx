import React from "react";
import PropTypes from "prop-types";

import {
  Card,
  CardContent,
  Typography,
  Box,
  Stack,
  Skeleton,
  IconButton,
  Tooltip,
} from "@mui/material";

import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import MoreVertIcon from "@mui/icons-material/MoreVert";

/**
 * ============================================================
 * Goal Tracker Management System
 * Dashboard KPI Card
 * ============================================================
 */

const DashboardCard = ({
  title,
  value,
  subtitle = "",
  icon = null,

  color = "primary.main",

  trend = null,
  trendValue = "",

  loading = false,

  onClick = null,
  onMoreClick = null,

  sx = {},
}) => {
  const clickable = typeof onClick === "function";

  return (
    <Card
      elevation={0}
      onClick={onClick}
      sx={{
        cursor: clickable ? "pointer" : "default",
        transition: "0.25s",

        "&:hover": clickable
          ? {
              transform: "translateY(-3px)",
              boxShadow: 3,
            }
          : {},

        ...sx,
      }}
    >
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={2}
        >
          {/* Left Section */}
          <Box flex={1}>
            {loading ? (
              <>
                <Skeleton
                  width={120}
                  height={25}
                />

                <Skeleton
                  width={90}
                  height={45}
                />

                <Skeleton
                  width={180}
                  height={20}
                />
              </>
            ) : (
              <>
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  {title}
                </Typography>

                <Typography
                  variant="h4"
                  fontWeight={700}
                  sx={{
                    mt: 1,
                  }}
                >
                  {value}
                </Typography>

                {subtitle && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mt: 1,
                    }}
                  >
                    {subtitle}
                  </Typography>
                )}
              </>
            )}
          </Box>

          {/* Right Section */}
          <Stack
            spacing={1}
            alignItems="flex-end"
          >
            {onMoreClick && !loading && (
              <Tooltip title="More">
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoreClick(event);
                  }}
                >
                  <MoreVertIcon
                    fontSize="small"
                  />
                </IconButton>
              </Tooltip>
            )}

            {!loading && icon && (
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  bgcolor: color,
                  color: "white",

                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",

                  "& svg": {
                    fontSize: 30,
                  },
                }}
              >
                {icon}
              </Box>
            )}

            {loading && (
              <Skeleton
                variant="rounded"
                width={56}
                height={56}
              />
            )}
          </Stack>
        </Stack>

        {/* Trend */}
        {!loading &&
          trend &&
          trendValue && (
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{
                mt: 2,
              }}
            >
              {trend === "up" ? (
                <TrendingUpIcon
                  fontSize="small"
                  color="success"
                />
              ) : (
                <TrendingDownIcon
                  fontSize="small"
                  color="error"
                />
              )}

              <Typography
                variant="caption"
                color={
                  trend === "up"
                    ? "success.main"
                    : "error.main"
                }
                fontWeight={600}
              >
                {trendValue}
              </Typography>
            </Stack>
          )}
      </CardContent>
    </Card>
  );
};

DashboardCard.propTypes = {
  title: PropTypes.string.isRequired,

  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]).isRequired,

  subtitle: PropTypes.string,

  icon: PropTypes.node,

  color: PropTypes.string,

  trend: PropTypes.oneOf([
    "up",
    "down",
    null,
  ]),

  trendValue: PropTypes.string,

  loading: PropTypes.bool,

  onClick: PropTypes.func,

  onMoreClick: PropTypes.func,

  sx: PropTypes.object,
};

export default DashboardCard;