import React from "react";
import { Box, Button, Typography } from "@mui/material";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { useNavigate } from "react-router-dom";

const NotFound = () => {

    const navigate = useNavigate();

    return (
        <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            minHeight="100vh"
        >
            <SearchOffIcon sx={{ fontSize: 100, color: "#2196f3" }} />

            <Typography variant="h2" fontWeight="bold" mt={2}>
                404
            </Typography>

            <Typography variant="h5">
                Page Not Found
            </Typography>

            <Typography mt={2} color="text.secondary">
                The page you are looking for does not exist.
            </Typography>

            <Button
                sx={{ mt: 4 }}
                variant="contained"
                onClick={() => navigate("/dashboard")}
            >
                Back To Dashboard
            </Button>
        </Box>
    );
};

export default NotFound;