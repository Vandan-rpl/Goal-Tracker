import React, { useEffect } from "react";
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    IconButton,
    Stack,
    Typography,
    Tooltip
} from "@mui/material";

import Grid from "@mui/material/Grid";

import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import NotificationsIcon from "@mui/icons-material/Notifications";

import EmptyState from "../../components/EmptyState/EmptyState";

import { useDispatch, useSelector } from "react-redux";

import {
    fetchNotifications,
    markAsRead,
    markAllRead,
    deleteNotification,
    deleteAllNotifications
} from "../../redux/slices/notificationSlice";

const Notifications = () => {

    const dispatch = useDispatch();

    const {
        notifications,
        loading
    } = useSelector((state) => state.notification);

    useEffect(() => {

        dispatch(fetchNotifications());

    }, [dispatch]);

    const handleRead = (id) => {

        dispatch(markAsRead(id));

    };

    const handleDelete = (id) => {

        dispatch(deleteNotification(id));

    };

    const handleReadAll = () => {

        dispatch(markAllRead());

    };

    const handleDeleteAll = () => {

        dispatch(deleteAllNotifications());

    };

    return (

        <Box p={3}>

            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                mb={3}
            >

                <Typography
                    variant="h4"
                    fontWeight="bold"
                >

                    Notifications

                </Typography>

                <Stack
                    direction="row"
                    spacing={2}
                >

                    <Button
                        variant="contained"
                        startIcon={<MarkEmailReadIcon />}
                        onClick={handleReadAll}
                    >
                        Mark All Read
                    </Button>

                    <Button
                        color="error"
                        variant="contained"
                        startIcon={<DeleteSweepIcon />}
                        onClick={handleDeleteAll}
                    >
                        Delete All
                    </Button>

                </Stack>

            </Stack>

            {

                loading ?

                    (

                        <Box
                            display="flex"
                            justifyContent="center"
                            mt={10}
                        >

                            <CircularProgress />

                        </Box>

                    )

                    :

                    (

                        <Grid
                            container
                            spacing={3}
                        >

                            {

                                notifications.length === 0 ?

                                    (

                                        <Grid item xs={12}>

                                            <Card>

                                                <CardContent>

                                                    <EmptyState
                                                        icon={<NotificationsIcon sx={{ fontSize: 40 }} />}
                                                        title="No notifications yet"
                                                        description="You're all caught up. New updates on your goals and approvals will show up here."
                                                    />

                                                </CardContent>

                                            </Card>

                                        </Grid>

                                    )

                                    :

                                    notifications.map((item) => (

                                        <Grid
                                            item
                                            xs={12}
                                            key={item.NotificationId}
                                        >

                                            <Card
                                                sx={{
                                                    borderLeft:
                                                        item.IsRead
                                                            ? "5px solid #4CAF50"
                                                            : "5px solid #FF9800"
                                                }}
                                            >

                                                <CardContent>

                                                    <Stack
                                                        direction="row"
                                                        justifyContent="space-between"
                                                    >

                                                        <Box>

                                                            <Typography
                                                                variant="h6"
                                                                fontWeight="bold"
                                                            >
                                                                {item.Title}
                                                            </Typography>

                                                            <Typography
                                                                variant="body2"
                                                                mt={1}
                                                            >
                                                                {item.Message}
                                                            </Typography>

                                                            <Stack
                                                                direction="row"
                                                                spacing={2}
                                                                mt={2}
                                                            >

                                                                <Chip
                                                                    label={item.NotificationType}
                                                                    color="primary"
                                                                    size="small"
                                                                />

                                                                <Chip
                                                                    label={
                                                                        item.IsRead
                                                                            ? "Read"
                                                                            : "Unread"
                                                                    }
                                                                    color={
                                                                        item.IsRead
                                                                            ? "success"
                                                                            : "warning"
                                                                    }
                                                                    size="small"
                                                                />

                                                            </Stack>

                                                            <Typography
                                                                variant="caption"
                                                                display="block"
                                                                mt={2}
                                                            >
                                                                {new Date(item.CreatedAt).toLocaleString()}
                                                            </Typography>

                                                        </Box>

                                                        <Stack spacing={1}>

                                                            {

                                                                !item.IsRead &&

                                                                (

                                                                    <Tooltip title="Mark As Read">

                                                                        <IconButton
                                                                            color="success"
                                                                            onClick={() =>
                                                                                handleRead(item.NotificationId)
                                                                            }
                                                                        >

                                                                            <MarkEmailReadIcon />

                                                                        </IconButton>

                                                                    </Tooltip>

                                                                )

                                                            }

                                                            <Tooltip title="Delete">

                                                                <IconButton
                                                                    color="error"
                                                                    onClick={() =>
                                                                        handleDelete(item.NotificationId)
                                                                    }
                                                                >

                                                                    <DeleteIcon />

                                                                </IconButton>

                                                            </Tooltip>

                                                        </Stack>

                                                    </Stack>

                                                </CardContent>

                                            </Card>

                                        </Grid>

                                    ))

                            }

                        </Grid>

                    )

            }

        </Box>

    );

};

export default Notifications;