import React from "react";
import { Box, Button, Typography } from "@mui/material";
// import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HomeIcon from "@mui/icons-material/Home";
import { useNavigate } from "react-router-dom";

const ServerError = () => {

    const navigate = useNavigate();

    return (
        <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            minHeight="100vh"
        >
            <ErrorOutlineIcon sx={{ fontSize: 100, color: "#d32f2f" }} />

            <Typography variant="h2" fontWeight="bold" mt={2}>
                500
            </Typography>

            <Typography variant="h5">
                Internal Server Error
            </Typography>

            <Typography mt={2} color="text.secondary">
                Something went wrong on the server. Please try again later.
            </Typography>

            <Button
                sx={{ mt: 4 }}
                variant="contained"
                onClick={() => navigate("/dashboard")}
            >
                Try Again
            </Button>
        </Box>
    );
};

export default ServerError;