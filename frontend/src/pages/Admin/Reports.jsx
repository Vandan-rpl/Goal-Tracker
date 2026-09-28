import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

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
  const { user } = useAuth();
  const role = String(user?.Role || user?.role || '').trim().toUpperCase();
  const isTeamView = ['MANAGER', 'HOD'].includes(role);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [teamStats, setTeamStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError('');

        const [statsRes, breakdownRes] = await Promise.all([
          api.get('analytics/dashboard-stats'),
          api.get(isTeamView ? 'analytics/team-stats' : 'analytics/department-stats'),
        ]);

        if (statsRes.data.success) setDashboardStats(statsRes.data.data);
        if (breakdownRes.data.success) {
          if (isTeamView) setTeamStats(breakdownRes.data.data || []);
          else setDepartmentStats(breakdownRes.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load reports', err);
        setError(err.response?.data?.message || 'Failed to load analytics data.');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [isTeamView]);

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
            {isTeamView
              ? 'Team goal progress by member, limited to your active direct reports.'
              : 'Organization-wide goal reporting and completion trends.'}
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

        {isTeamView ? (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800">Team goals by member</h2>
              <p className="text-sm text-gray-500 mt-1">Compare review workload and completion across your team.</p>
            </div>
            {teamStats.length > 0 ? (
              <>
                <div className="w-full overflow-x-auto">
                  <div className="min-w-155">
                    <ResponsiveContainer width="100%" height={Math.min(560, Math.max(260, teamStats.length * 48))}>
                      <BarChart data={teamStats} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 8 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="employeeName" width={140} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="pendingGoals" name="Needs review" stackId="goals" fill="#D97706" />
                        <Bar dataKey="activeGoals" name="In progress" stackId="goals" fill="#2563EB" />
                        <Bar dataKey="completedGoals" name="Completed" stackId="goals" fill="#059669" />
                        <Bar dataKey="otherGoals" name="Draft / closed" stackId="goals" fill="#9CA3AF" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-155 text-left text-sm">
                    <thead className="border-y border-gray-200 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="py-3 pr-4 font-semibold">Team member</th>
                        <th className="py-3 px-3 text-right font-semibold">Total</th>
                        <th className="py-3 px-3 text-right font-semibold">Needs review</th>
                        <th className="py-3 px-3 text-right font-semibold">In progress</th>
                        <th className="py-3 px-3 text-right font-semibold">Completed</th>
                        <th className="py-3 pl-3 text-right font-semibold">Draft / closed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {teamStats.map((member) => (
                        <tr key={member.UserID}>
                          <td className="py-3 pr-4 font-medium text-gray-900">{member.employeeName}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{member.totalGoals}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{member.pendingGoals}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{member.activeGoals}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{member.completedGoals}</td>
                          <td className="py-3 pl-3 text-right tabular-nums">{member.otherGoals}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500 text-center py-12 border border-dashed border-gray-200 rounded-xl">
                No active team members found.
              </div>
            )}
          </section>
        ) : (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
          </section>
        )}

        
      </div>
    </div>
  );
};

export default Reports;
