import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const ReviewEmployeeGoal = () => {
  const [employeesGoals, setEmployeesGoals] = useState([]);

  useEffect(() => {
    fetchEmployeeGoals();
  }, []);

  const fetchEmployeeGoals = async () => {
    try {
      const res = await api.get('/manager/employee-goals');
      setEmployeesGoals(res.data);
    } catch (err) {
      console.error('Failed to fetch employee goals', err);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Review Employee Goal Performance</h2>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Goal</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employeesGoals.length > 0 ? employeesGoals.map((goal) => (
              <tr key={goal._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{goal.user?.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{goal.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{goal.progress || '0'}%</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">{goal.status}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">No records available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReviewEmployeeGoal;