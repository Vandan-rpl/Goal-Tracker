import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Grid, Paper } from '@mui/material';
import { Add } from '@mui/icons-material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import API from '../../services/api';

const GoalsPage = () => {
    const [rowData, setRowData] = useState([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        departmentId: 1,
        quarter: 'Q1 2026',
        weightage: 20,
        description: '',
        isSubmitted: false
    });

    const fetchGoals = async () => {
        try {
            const res = await API.get('/goals/list');
            setRowData(res.data.data);
        } catch (err) {
            console.error('Failed to fetch goals:', err);
        }
    };

    useEffect(() => {
        fetchGoals();
    }, []);

    const columnDefs = [
        { headerName: 'Goal Title', field: 'Title', flex: 2, sortable: true, filter: true },
        { headerName: 'Quarter', field: 'Quarter', flex: 1, sortable: true },
        { headerName: 'Weightage (%)', field: 'Weightage', flex: 1, sortable: true },
        { headerName: 'Progress (%)', field: 'Progress', flex: 1, sortable: true },
        { headerName: 'Status', field: 'Status', flex: 1, cellStyle: params => ({ fontWeight: 'bold', color: params.value === 'Completed' ? '#2e7d32' : '#1565c0' }) }
    ];

    const handleCreateGoal = async (submitFlag) => {
        try {
            await API.post('/goals/create', { ...formData, isSubmitted: submitFlag });
            setOpenDialog(false);
            fetchGoals();
        } catch (err) {
            alert(err.response?.data?.message || 'Error creating goal.');
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" color="#1e293b">Goals Management</Typography>
                    <Typography variant="body2" color="textSecondary">Create, manage, and track individual key performance indicators.</Typography>
                </Box>
                <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)} sx={{ backgroundColor: '#1565c0', fontWeight: 'bold', borderRadius: '8px' }}>
                    Add Goal
                </Button>
            </Box>

            {/* AG Grid Container */}
            <Paper elevation={0} sx={{ height: 450, width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
                    <AgGridReact rowData={rowData} columnDefs={columnDefs} pagination={true} paginationPageSize={10} />
                </div>
            </Paper>

            {/* Create Goal Dialog */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle fontWeight="bold">Create New Goal</DialogTitle>
                <DialogContent dividers>
                    <TextField fullWidth label="Goal Title" margin="normal" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <TextField fullWidth select label="Quarter" margin="normal" value={formData.quarter} onChange={e => setFormData({...formData, quarter: e.target.value})}>
                                <MenuItem value="Q1 2026">Q1 2026</MenuItem>
                                <MenuItem value="Q2 2026">Q2 2026</MenuItem>
                                <MenuItem value="Q3 2026">Q3 2026</MenuItem>
                                <MenuItem value="Q4 2026">Q4 2026</MenuItem>
                            </TextField>
                        </Grid>
                        <Grid item xs={6}>
                            <TextField fullWidth type="number" label="Weightage (%)" margin="normal" value={formData.weightage} onChange={e => setFormData({...formData, weightage: e.target.value})} />
                        </Grid>
                    </Grid>
                    <TextField fullWidth multiline rows={3} label="Description & Metrics" margin="normal" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => handleCreateGoal(false)} variant="outlined" color="primary">Save as Draft</Button>
                    <Button onClick={() => handleCreateGoal(true)} variant="contained" sx={{ backgroundColor: '#1565c0' }}>Submit for Approval</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default GoalsPage;