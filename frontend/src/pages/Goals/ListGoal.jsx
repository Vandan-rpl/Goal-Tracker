import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import TableLoader from '../../components/loaders/TableLoader';
import EmptyState from '../../components/EmptyState/EmptyState';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import { Button } from '@mui/material';
import api from '../../services/api';

const STATUS_OPTIONS = [
  'Draft', 'Submitted', 'HOD Approved', 'Reviewed By HOD',
  'Business Head Approved', 'Review By Business Head', 'Rejected',
  'Completed', 'Cancelled', 'Running', 'Approved', 'Postpone',
];

// TODO: confirm this matches the real stored format
// (SELECT DISTINCT Quarter FROM dbo.Goals) before relying on this list.
const QUARTER_OPTIONS = [
  'Q1-2026', 'Q2-2026', 'Q3-2026', 'Q4-2026',
  'Q1-2027', 'Q2-2027', 'Q3-2027', 'Q4-2027',
];

const ListGoal = () => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quarter, setQuarter] = useState('');
  const [status, setStatus] = useState('');

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (quarter) params.quarter = quarter;
      if (status) params.status = status;

      const res = await api.get('/goals', { params });
      if (res.data.success) {
        setGoals(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching goals', err);
      setError('Failed to load goals.');
    } finally {
      setLoading(false);
    }
  }, [quarter, status]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleDelete = async (goalId) => {
    if (window.confirm('Are you sure you want to delete this goal?')) {
      try {
        await api.delete(`/goals/${goalId}`);
        setGoals(goals.filter(g => g.GoalID !== goalId));
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete goal');
      }
    }
  };

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Goal Management</h1>
            <p className="text-sm text-gray-500 mt-1">View, track, and manage your performance goals.</p>
          </div>
          <Link
            to="/goals/add"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md transition flex items-center"
          >
            + Add New Goal
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Quarter
            </label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Quarters</option>
              {QUARTER_OPTIONS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {(quarter || status) && (
            <div className="flex items-end">
              <button
                onClick={() => { setQuarter(''); setStatus(''); }}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-3 py-2"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">{error}</div>}

        {/* Goals Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/75">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Goal No / Title</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Weightage</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="p-0">
                      <TableLoader rows={5} columns={6} showToolbar={false} paper={false} />
                    </td>
                  </tr>
                ) : goals.length > 0 ? (
                  goals.map((goal) => (
                    <tr key={goal.GoalID} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">#{goal.GoalNumber} - {goal.GoalTitle}</div>
                        <div className="text-xs text-gray-400">Timeline: {goal.Timeline ? new Date(goal.Timeline).toLocaleDateString() : 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {goal.GoalCategory || 'General'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
                        {goal.Weightage}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          goal.Priority === 'High' ? 'bg-orange-100 text-orange-800' :
                          goal.Priority === 'Medium' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {goal.Priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          goal.GoalStatus === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                          goal.GoalStatus === 'Submitted' ? 'bg-indigo-100 text-indigo-800' :
                          goal.GoalStatus === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {goal.GoalStatus || 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <Link to={`/goals/view/${goal.GoalID}`} className="text-indigo-600 hover:text-indigo-900 font-semibold">View</Link>

                        {goal.GoalStatus !== 'Submitted' && (
                          <Link to={`/goals/edit/${goal.GoalID}`} className="text-blue-600 hover:text-blue-900 font-semibold">Edit</Link>
                        )}

                        {goal.GoalStatus === 'Draft' && (
                          <button onClick={() => handleDelete(goal.GoalID)} className="text-red-600 hover:text-red-900 font-semibold">Delete</button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="p-0">
                      <EmptyState
                        icon={<AssignmentOutlinedIcon sx={{ fontSize: 40 }} />}
                        title="No goals found"
                        description="No goals match the selected filters."
                        action={
                          <Button component={Link} to="/goals/add" size="small">
                            Add New Goal
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ListGoal;