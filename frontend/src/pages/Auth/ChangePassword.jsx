import React, { useState } from "react";
import {
    Box,
    Button,
    Card,
    CardContent,
    TextField,
    Typography,
    Alert,
    Stack
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import profileApi from "../../api/profileApi";
import { useNavigate } from "react-router-dom";

const ChangePassword = () => {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    const [message, setMessage] = useState({ type: "", text: "" });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });

        if (formData.newPassword !== formData.confirmPassword) {
            setMessage({ type: "error", text: "New password and confirm password do not match." });
            return;
        }

        try {
            setLoading(true);
            const response = await profileApi.changePassword({
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword,
                confirmPassword: formData.confirmPassword
            });

            setMessage({ type: "success", text: response.message || "Password changed successfully." });
            
            setTimeout(() => {
                navigate("/profile");
            }, 1500);

        } catch (error) {
            setMessage({ 
                type: "error", 
                text: error.message || error.error || "Failed to change password." 
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ p: 3, maxWidth: 600, mx: "auto" }}>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: "bold" }}>
                Change Password
            </Typography>

            <Card>
                <CardContent>
                    {message.text && (
                        <Alert severity={message.type} sx={{ mb: 3 }}>
                            {message.text}
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit}>
                        <Stack spacing={3}>
                            <TextField
                                fullWidth
                                type="password"
                                label="Current Password"
                                name="currentPassword"
                                value={formData.currentPassword}
                                onChange={handleChange}
                                required
                            />

                            <TextField
                                fullWidth
                                type="password"
                                label="New Password"
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleChange}
                                required
                            />

                            <TextField
                                fullWidth
                                type="password"
                                label="Confirm New Password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                            />

                            <Stack direction="row" spacing={2}>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    startIcon={<LockResetIcon />}
                                    disabled={loading}
                                >
                                    {loading ? "Changing..." : "Update Password"}
                                </Button>

                                <Button
                                    variant="outlined"
                                    color="inherit"
                                    onClick={() => navigate("/profile")}
                                >
                                    Cancel
                                </Button>
                            </Stack>
                        </Stack>
                    </form>
                </CardContent>
            </Card>
        </Box>
    );
};

export default ChangePassword;