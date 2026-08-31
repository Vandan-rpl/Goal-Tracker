import React, { useEffect, useState } from "react";
import {
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Divider,
    Grid,
    Stack,
    TextField,
    Typography
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import LockResetIcon from "@mui/icons-material/LockReset";

import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import {
    fetchProfile,
    updateProfile,
    uploadAvatar
} from "../../redux/slices/profileSlice";

const Profile = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // Redux માંથી user state અથવા profile state સેફલી ફેચ કરો
    const { profile = {}, loading = false } = useSelector(
        (state) => state.profile || {}
    );
    
    // Auth state માંથી પણ યુઝર ડેટા બેકઅપ તરીકે લઈ શકાય
    const { user } = useSelector((state) => state.auth || {});

    const [editMode, setEditMode] = useState(false);

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        mobileNo: ""
    });

    useEffect(() => {
        dispatch(fetchProfile());
    }, [dispatch]);

    useEffect(() => {
        // profile કે user જે પણ અવેલેબલ હોય તેનાથી ફોર્મ સેટ કરો
        const activeData = profile?.UserID ? profile : user;
        if (activeData) {
            setFormData({
                firstName: activeData.FirstName || activeData.firstName || "",
                lastName: activeData.LastName || activeData.lastName || "",
                email: activeData.Email || activeData.email || "",
                mobileNo: activeData.MobileNo || activeData.mobileNo || ""
            });
        }
    }, [profile, user]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSave = () => {
        dispatch(updateProfile(formData));
        setEditMode(false);
    };

    const handleAvatar = (e) => {
        if (!e.target.files.length) return;
        const file = new FormData();
        file.append("avatar", e.target.files[0]);
        dispatch(uploadAvatar(file));
    };

    if (loading) {
        return (
            <Box
                sx={{ display: "flex", justifyContent: "center", mt: 10 }}
            >
                <CircularProgress />
            </Box>
        );
    }

    const currentProfile = profile?.UserID ? profile : user;

    return (
        <Box sx={{ p: 3 }}>
            <Typography
                variant="h4"
                sx={{ mb: 3, fontWeight: "bold" }}
            >
                My Profile
            </Typography>

            <Card>
                <CardContent>
                    <Grid container spacing={4}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center"
                                }}
                            >
                                <Avatar
                                    src={currentProfile?.ProfilePhoto || ""}
                                    sx={{
                                        width: 140,
                                        height: 140
                                    }}
                                />

                                <Button
                                    sx={{ mt: 2 }}
                                    component="label"
                                    startIcon={<PhotoCameraIcon />}
                                    variant="contained"
                                >
                                    Upload Photo
                                    <input
                                        hidden
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatar}
                                    />
                                </Button>

                                <Typography
                                    sx={{ mt: 3, fontWeight: "600" }}
                                    variant="h6"
                                >
                                    {currentProfile?.FullName || `${formData.firstName} ${formData.lastName}`}
                                </Typography>

                                <Typography
                                    color="text.secondary"
                                >
                                    {currentProfile?.Designation || "Employee"}
                                </Typography>

                                <Typography
                                    color="text.secondary"
                                >
                                    {currentProfile?.DepartmentName || ""}
                                </Typography>
                            </Box>
                        </Grid>

                        <Grid size={{ xs: 12, md: 8 }}>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        fullWidth
                                        label="First Name"
                                        name="firstName"
                                        value={formData.firstName}
                                        disabled={!editMode}
                                        onChange={handleChange}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        fullWidth
                                        label="Last Name"
                                        name="lastName"
                                        value={formData.lastName}
                                        disabled={!editMode}
                                        onChange={handleChange}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        fullWidth
                                        label="Email"
                                        name="email"
                                        value={formData.email}
                                        disabled={!editMode}
                                        onChange={handleChange}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        fullWidth
                                        label="Mobile"
                                        name="mobileNo"
                                        value={formData.mobileNo}
                                        disabled={!editMode}
                                        onChange={handleChange}
                                    />
                                </Grid>
                            </Grid>

                            <Divider sx={{ my: 3 }} />

                            <Stack
                                direction="row"
                                spacing={2}
                            >
                                {editMode ? (
                                    <Button
                                        variant="contained"
                                        startIcon={<SaveIcon />}
                                        onClick={handleSave}
                                    >
                                        Save
                                    </Button>
                                ) : (
                                    <Button
                                        variant="contained"
                                        startIcon={<EditIcon />}
                                        onClick={() => setEditMode(true)}
                                    >
                                        Edit Profile
                                    </Button>
                                )}

                                <Button
                                    color="warning"
                                    variant="outlined"
                                    startIcon={<LockResetIcon />}
                                    onClick={() => navigate("/change-password")}
                                >
                                    Change Password
                                </Button>
                            </Stack>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
        </Box>
    );
};

export default Profile;