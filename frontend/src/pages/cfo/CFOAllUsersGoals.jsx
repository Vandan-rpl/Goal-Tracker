import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const CFOAllUsersGoals = () => {
  const [allGoals, setAllGoals] = useState([]);

  useEffect(() => {
    fetchAllGoals();
  }, []);

  const fetchAllGoals = async () => {
    try {
      const res = await api.get('/cfo/all-goals');
      setAllGoals(res.data);
    } catch (err) {
      console.error('Failed to fetch enterprise goals', err);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Enterprise-Wide Goals Overview (CFO Access)</h2>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Goal Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {allGoals.length > 0 ? allGoals.map((goal) => (
              <tr key={goal._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{goal.user?.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{goal.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{goal.category}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">{goal.status}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">No organization data found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CFOAllUsersGoals;