import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../../services/api';

// NOTE: no reports/analytics page existed anywhere under src/pages/Admin/
// or src/pages/cfo/ before this (only CFOAllUsersGoals.jsx, a plain goals
// table with no charts). `recharts` was already a dependency in
// package.json — used here rather than adding a new charting library.

const StatCard = ({ label, value, accent }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
    <p className={`text-3xl font-black mt-1 ${accent}`}>{value}</p>
  </div>
);

const Reports = () => {
  const [dashboardStats, setDashboardStats] = useState(null);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [quarterTrends, setQuarterTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');

      const [statsRes, deptRes, trendRes] = await Promise.all([
        api.get('analytics/dashboard-stats'),
        api.get('analytics/department-stats'),
        api.get('analytics/quarter-trends'),
      ]);

      if (statsRes.data.success) setDashboardStats(statsRes.data.data);
      if (deptRes.data.success) setDepartmentStats(deptRes.data.data || []);
      if (trendRes.data.success) setQuarterTrends(trendRes.data.data || []);
    } catch (err) {
      console.error('Failed to load reports', err);
      setError(err.response?.data?.message || 'Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-gray-50 min-h-screen flex items-center justify-center text-gray-500">
        Loading reports...
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Scoped to what your role can see — your own goals if you're an employee, your team's if
            you're an HOD/Business Head, or company-wide if you're an Admin.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">{error}</div>
        )}

        {/* Summary Cards */}
        {dashboardStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Goals" value={dashboardStats.totalGoals} accent="text-gray-900" />
            <StatCard label="Pending Approval" value={dashboardStats.pendingApproval} accent="text-amber-600" />
            <StatCard label="Completed" value={dashboardStats.completedGoals} accent="text-emerald-600" />
            <StatCard
              label="Avg. Rating"
              value={dashboardStats.currentRating ? Number(dashboardStats.currentRating).toFixed(2) : 'N/A'}
              accent="text-indigo-600"
            />
          </div>
        )}

        {/* Department Stats */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Goals by Department</h2>
          {departmentStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="department" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalGoals" name="Total Goals" fill="#6366F1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completedGoals" name="Completed" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-gray-500 text-center py-12 border border-dashed border-gray-200 rounded-xl">
              No department data available.
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};

export default Reports;
