import React from "react";
import PropTypes from "prop-types";

import { LoadingButton } from "@mui/lab";

/**
 * ============================================================
 * Goal Tracker Management System
 * Button Loader Component
 * ============================================================
 */

const ButtonLoader = ({
  loading = false,
  children = "Submit",
  loadingText = "Please wait...",
  variant = "contained",
  color = "primary",
  size = "medium",
  fullWidth = false,
  disabled = false,
  type = "button",
  startIcon,
  endIcon,
  onClick,
  sx = {},
  ...rest
}) => {
  return (
    <LoadingButton
      loading={loading}
      loadingPosition="start"
      variant={variant}
      color={color}
      size={size}
      fullWidth={fullWidth}
      disabled={disabled || loading}
      type={type}
      startIcon={startIcon}
      endIcon={endIcon}
      onClick={onClick}
      sx={{
        minWidth: 140,
        borderRadius: 2,
        textTransform: "none",
        fontWeight: 600,
        ...sx,
      }}
      {...rest}
    >
      {loading ? loadingText : children}
    </LoadingButton>
  );
};

ButtonLoader.propTypes = {
  loading: PropTypes.bool,
  children: PropTypes.node,
  loadingText: PropTypes.string,
  variant: PropTypes.oneOf([
    "contained",
    "outlined",
    "text",
  ]),
  color: PropTypes.oneOf([
    "primary",
    "secondary",
    "success",
    "error",
    "warning",
    "info",
    "inherit",
  ]),
  size: PropTypes.oneOf([
    "small",
    "medium",
    "large",
  ]),
  fullWidth: PropTypes.bool,
  disabled: PropTypes.bool,
  type: PropTypes.oneOf([
    "button",
    "submit",
    "reset",
  ]),
  startIcon: PropTypes.node,
  endIcon: PropTypes.node,
  onClick: PropTypes.func,
  sx: PropTypes.object,
};

export default ButtonLoader;