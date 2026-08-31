import React from "react";
import { Box, Button, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useNavigate } from "react-router-dom";

const Unauthorized = () => {

    const navigate = useNavigate();

    return (
        <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            minHeight="100vh"
        >
            <LockOutlinedIcon sx={{ fontSize: 100, color: "#ff9800" }} />

            <Typography variant="h2" fontWeight="bold" mt={2}>
                401
            </Typography>

            <Typography variant="h5" mt={1}>
                Unauthorized
            </Typography>

            <Typography color="text.secondary" mt={2}>
                Please login to access this page.
            </Typography>

            <Button
                sx={{ mt: 4 }}
                variant="contained"
                onClick={() => navigate("/login")}
            >
                Go To Login
            </Button>
        </Box>
    );
};

export default Unauthorized;