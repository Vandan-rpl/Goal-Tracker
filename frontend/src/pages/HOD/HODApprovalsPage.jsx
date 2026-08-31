import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';
import API from '../../services/api';

const HODApprovalsPage = () => {
    const [goals, setGoals] = useState([]);

    const fetchPendingGoals = async () => {
        try {
            const res = await API.get('/goals/list');
            // Filter goals awaiting HOD review
            setGoals(res.data.data.filter(g => g.Status === 'Pending Approval' || g.Status === 'Draft'));
        } catch (err) {
            console.error('Failed to fetch approval list:', err);
        }
    };

    useEffect(() => {
        fetchPendingGoals();
    }, []);

    const handleAction = async (goalId, status) => {
        try {
            await API.patch(`/goals/${goalId}/approval`, { status });
            fetchPendingGoals();
        } catch (err) {
            alert(err.response?.data?.message || 'Action failed.');
        }
    };

    return (
        <Box>
            <Typography variant="h4" fontWeight="bold" color="#1e293b" gutterBottom>HOD Goal Approvals</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 4 }}>Review and approve submitted employee department goals.</Typography>

            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                <Table>
                    <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                        <TableRow>
                            <TableCell fontWeight="bold">Employee</TableCell>
                            <TableCell fontWeight="bold">Goal Title</TableCell>
                            <TableCell fontWeight="bold">Quarter</TableCell>
                            <TableCell fontWeight="bold">Weightage</TableCell>
                            <TableCell fontWeight="bold">Status</TableCell>
                            <TableCell align="right" fontWeight="bold">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {goals.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#64748b' }}>No pending approvals found.</TableCell>
                            </TableRow>
                        ) : (
                            goals.map((row) => (
                                <TableRow key={row.GoalId}>
                                    <TableCell>{row.EmployeeName || 'Employee'}</TableCell>
                                    <TableCell fontWeight="medium">{row.Title}</TableCell>
                                    <TableCell>{row.Quarter}</TableCell>
                                    <TableCell>{row.Weightage}%</TableCell>
                                    <TableCell><Chip label={row.Status} color="warning" size="small" /></TableCell>
                                    <TableCell align="right" sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                        <Button variant="contained" color="success" size="small" onClick={() => handleAction(row.GoalId, 'Approved')}>Approve</Button>
                                        <Button variant="outlined" color="error" size="small" onClick={() => handleAction(row.GoalId, 'Rejected')}>Reject</Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default HODApprovalsPage;