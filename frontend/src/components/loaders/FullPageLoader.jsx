import React from "react";
import PropTypes from "prop-types";

import {
  Backdrop,
  Box,
  CircularProgress,
  Fade,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

/**
 * ============================================================
 * Goal Tracker Management System
 * Full Page Loader
 * ============================================================
 */

const FullPageLoader = ({
  open = true,
  message = "Loading...",
  backdrop = true,
  size = 56,
}) => {
  const content = (
    <Fade in={open} timeout={300}>
      <Paper
        elevation={6}
        sx={{
          px: 5,
          py: 4,
          borderRadius: 3,
          minWidth: 260,
          textAlign: "center",
        }}
      >
        <Stack
          spacing={3}
          alignItems="center"
        >
          <CircularProgress
            size={size}
            thickness={4}
          />

          <Typography
            variant="body1"
            color="text.primary"
            fontWeight={500}
          >
            {message}
          </Typography>
        </Stack>
      </Paper>
    </Fade>
  );

  if (backdrop) {
    return (
      <Backdrop
        open={open}
        sx={{
          zIndex: (theme) =>
            theme.zIndex.drawer + 999,
          backgroundColor:
            "rgba(0,0,0,0.35)",
        }}
      >
        {content}
      </Backdrop>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        width: "100%",
        backgroundColor:
          "background.default",
      }}
    >
      {content}
    </Box>
  );
};

FullPageLoader.propTypes = {
  open: PropTypes.bool,
  message: PropTypes.string,
  backdrop: PropTypes.bool,
  size: PropTypes.number,
};

export default FullPageLoader;