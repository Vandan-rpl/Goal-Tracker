import React from "react";
import PropTypes from "prop-types";

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";

/**
 * ============================================================
 * Goal Tracker Management System
 * Module Placeholder
 * ============================================================
 */

const STATUS = {
  DEVELOPMENT: "development",
  COMING_SOON: "coming-soon",
  COMPLETED: "completed",
  DISABLED: "disabled",
};

const statusConfig = {
  [STATUS.DEVELOPMENT]: {
    label: "Under Development",
    color: "warning",
    icon: <ConstructionOutlinedIcon />,
  },

  [STATUS.COMING_SOON]: {
    label: "Coming Soon",
    color: "info",
    icon: <ScheduleOutlinedIcon />,
  },

  [STATUS.COMPLETED]: {
    label: "Completed",
    color: "success",
    icon: <CheckCircleOutlineOutlinedIcon />,
  },

  [STATUS.DISABLED]: {
    label: "Disabled",
    color: "error",
    icon: <ErrorOutlineOutlinedIcon />,
  },
};

const ModulePlaceholder = ({
  moduleName = "Module",
  description = "This module is currently under development.",
  status = STATUS.DEVELOPMENT,

  actionText,
  onAction,
}) => {
  const config =
    statusConfig[status] ||
    statusConfig[STATUS.DEVELOPMENT];

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "60vh",
      }}
    >
      <Card
        elevation={0}
        sx={{
          maxWidth: 650,
          width: "100%",
          borderRadius: 3,
          textAlign: "center",
        }}
      >
        <CardContent
          sx={{
            p: 5,
          }}
        >
          <Stack
            spacing={3}
            alignItems="center"
          >
            <Box
              sx={{
                width: 90,
                height: 90,
                borderRadius: "50%",
                bgcolor: `${config.color}.light`,
                color: `${config.color}.main`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",

                "& svg": {
                  fontSize: 48,
                },
              }}
            >
              {config.icon}
            </Box>

            <Typography
              variant="h4"
              fontWeight={700}
            >
              {moduleName}
            </Typography>

            <Chip
              label={config.label}
              color={config.color}
            />

            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                maxWidth: 500,
              }}
            >
              {description}
            </Typography>

            {actionText &&
              typeof onAction ===
                "function" && (
                <Button
                  variant="contained"
                  onClick={onAction}
                >
                  {actionText}
                </Button>
              )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

ModulePlaceholder.propTypes = {
  moduleName: PropTypes.string,

  description: PropTypes.string,

  status: PropTypes.oneOf([
    STATUS.DEVELOPMENT,
    STATUS.COMING_SOON,
    STATUS.COMPLETED,
    STATUS.DISABLED,
  ]),

  actionText: PropTypes.string,

  onAction: PropTypes.func,
};

export { STATUS };

export default ModulePlaceholder;