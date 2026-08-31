import React, { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { Box, Card, Typography, Grid } from '@mui/material';

/**
 * NOTE: this page doesn't fetch real summary data yet (see the original
 * comment below — "You can fetch dashboard summary stats here if your API
 * exists") and dashboardApi.getDashboardHome() currently points at a
 * backend route that returns a 404 (see /dashboard/home in
 * src/api/dashboardApi.js vs the routes actually defined in
 * dashboardRoutes.js) — that's a real bug worth fixing separately, but not
 * something I'm inventing data for here. This pass only replaces the
 * hardcoded dark-slate Tailwind styling (which didn't match the rest of
 * the app's light theme anywhere else) with the same content restyled to
 * the new design system. No data/logic changed.
 */
const Dashboard = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // You can fetch dashboard summary stats here if your API exists
    setLoading(false);
  }, []);

  const role = user?.Role || user?.role;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        Dashboard Overview
      </Typography>

      {/* Welcome Card — most prominent element, per visual hierarchy guidance */}
      <Card sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Welcome back, {user?.FirstName || user?.username || 'User'}!
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Role: <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>{role}</Box>
        </Typography>
      </Card>

      {/* Supporting cards — secondary to the welcome card above */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="overline">Portal Status</Typography>
            <Typography variant="h4" fontWeight={700} color="success.main" sx={{ mt: 1 }}>
              Active
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="overline">System Role</Typography>
            <Typography variant="h4" fontWeight={700} color="primary.main" sx={{ mt: 1 }}>
              {role}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="overline">Quick Actions</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Use the sidebar to navigate to Goal Management or Team Approvals.
            </Typography>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
