import React from "react";
import { Box, Button, Typography } from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import { useNavigate } from "react-router-dom";

const Forbidden = () => {

    const navigate = useNavigate();

    return (
        <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            minHeight="100vh"
        >
            <BlockIcon sx={{ fontSize: 100, color: "#f44336" }} />

            <Typography variant="h2" fontWeight="bold" mt={2}>
                403
            </Typography>

            <Typography variant="h5">
                Access Forbidden
            </Typography>

            <Typography mt={2} color="text.secondary">
                You don't have permission to access this page.
            </Typography>

            <Button
                sx={{ mt: 4 }}
                variant="contained"
                onClick={() => navigate("/dashboard")}
            >
                Go To Dashboard
            </Button>
        </Box>
    );
};

export default Forbidden;