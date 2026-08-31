import React, { useState } from 'react';
import { Box, Paper, Typography, Button, Alert } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import API from '../../services/api';

const AdminPage = () => {
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) {
            setError('Please choose an Excel file first.');
            return;
        }

        const data = new FormData();
        data.append('file', file);
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const res = await API.post('/admin/upload-employees', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setMessage(res.data.message);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upload spreadsheet.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            <Typography variant="h4" fontWeight="bold" color="#1e293b" gutterBottom>HR Admin - Employee Onboarding</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 4 }}>Upload master employee excel sheets to automatically provision accounts.</Typography>

            <Paper elevation={0} sx={{ p: 5, maxWidth: '600px', border: '1px solid #e2e8f0', borderRadius: '16px', backgroundColor: '#ffffff' }}>
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}

                <Box component="form" onSubmit={handleUpload} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Button variant="outlined" component="label" sx={{ border: '2px dashed #cbd5e1', py: 6, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <CloudUpload fontSize="large" color="primary" />
                        <Typography variant="body1" fontWeight="medium">Click to browse or drag & drop Excel file</Typography>
                        <Typography variant="caption" color="textSecondary">{file ? file.name : '.xlsx, .xls supported'}</Typography>
                        <input type="file" hidden accept=".xlsx, .xls, .csv" onChange={(e) => setFile(e.target.files[0])} />
                    </Button>

                    <Button type="submit" variant="contained" disabled={loading} size="large" sx={{ backgroundColor: '#1565c0', py: '12px', fontWeight: 'bold', borderRadius: '8px' }}>
                        {loading ? 'Processing Spreadsheet...' : 'Upload & Provision Employees'}
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
};

export default AdminPage;