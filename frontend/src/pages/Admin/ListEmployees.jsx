import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const ListEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');

  // Fetch employees list on component load
  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/employees'); // Ensure you have this GET route on backend
      if (res.data.success) {
        setEmployees(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter employees based on search query (Name, Email, or Employee Code)
  const filteredEmployees = employees.filter((emp) => {
    const query = searchQuery.toLowerCase();
    const fullName = `${emp.FirstName || ''} ${emp.LastName || ''}`.toLowerCase();
    const email = (emp.Email || '').toLowerCase();
    const code = (emp.EmployeeCode || '').toLowerCase();
    return fullName.includes(query) || email.includes(query) || code.includes(query);
  });

  return (
    <div className="max-w-6xl mx-auto bg-white p-8 rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">Employee List</h2>
          <p className="text-sm text-gray-500">Manage all registered system users and employees.</p>
        </div>
        <input
          type="text"
          placeholder="Search by name, email, code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border rounded-md text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {message && <div className="mb-4 bg-green-50 text-green-600 p-3 rounded text-sm">{message}</div>}

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading employees...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-sm border-b">
                <th className="p-3">Code</th>
                <th className="p-3">Name</th>
                <th className="p-3">Username</th>
                <th className="p-3">Email</th>
                <th className="p-3">Department</th>
                <th className="p-3">Role</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => (
                  <tr key={emp.UserID} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-700">{emp.EmployeeCode || 'N/A'}</td>
                    <td className="p-3 text-gray-900 font-semibold">{emp.FirstName} {emp.LastName}</td>
                    <td className="p-3 text-gray-600">{emp.Username}</td>
                    <td className="p-3 text-gray-600">{emp.Email}</td>
                    <td className="p-3 text-gray-600">{emp.DepartmentName || 'N/A'}</td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {emp.Role}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${emp.IsActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {emp.IsActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-6 text-gray-400">No employees found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ListEmployees;