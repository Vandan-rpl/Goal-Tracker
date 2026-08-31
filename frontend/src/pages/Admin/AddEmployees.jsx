import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const AddEmployees = () => {
  const [formData, setFormData] = useState({
    EmployeeCode: '',
    Username: '',
    Email: '',
    FirstName: '',
    LastName: '',
    MobileNo: '',
    DepartmentID: '',
    Designation: '',
    Grade: '',
    Post: '',
    ReportingManagerID: '',
    HODID: '',
    BusinessHeadID: '',
    Role: 'Employee'
  });

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [message, setMessage] = useState('');
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    try {
      setLoadingDropdowns(true);
      const res = await api.get('/admin/dropdown-data');
      if (res.data.success) {
        setEmployees(res.data.data.employees || []);
        setDepartments(res.data.data.departments || []);
      }
    } catch (err) {
      console.error('Error fetching dropdown data:', err);
    } finally {
      setLoadingDropdowns(false);
    }
  };

  const slugify = (str) =>
    String(str || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '');

  const handleChange = (field, value) => {
    const updated = { ...formData, [field]: value };

    // Auto-generate Username & Email on First Name or Last Name modification
    if (field === 'FirstName' || field === 'LastName') {
      const firstSlug = slugify(field === 'FirstName' ? value : updated.FirstName);
      const lastSlug = slugify(field === 'LastName' ? value : updated.LastName);

      if (firstSlug && lastSlug) {
        updated.Username = `${firstSlug}.${lastSlug}`;
        updated.Email = `${firstSlug}.${lastSlug}@rubamin.com`;
      } else {
        updated.Username = '';
        updated.Email = '';
      }
    }

    setFormData(updated);
  };

  const managers = employees.filter((emp) => emp.Role === 'Manager');
  const hods = employees.filter((emp) => emp.Role === 'HOD');
  const businessHeads = employees.filter((emp) => emp.Role === 'BusinessHead');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        DepartmentID: formData.DepartmentID || null,
        ReportingManagerID: formData.ReportingManagerID || null,
        HODID: formData.HODID || null,
        BusinessHeadID: formData.BusinessHeadID || null
      };

      const res = await api.post('/admin/employees', payload);
      if (res.data.success) {
        setMessage(res.data.message || 'Employee added successfully!');
        setFormData({
          EmployeeCode: '', Username: '', Email: '', FirstName: '', LastName: '',
          MobileNo: '', DepartmentID: '', Designation: '', Grade: '', Post: '',
          ReportingManagerID: '', HODID: '', BusinessHeadID: '', Role: 'Employee'
        });
        fetchDropdownData();
      } else {
        alert(res.data.message || 'Failed to add employee');
      }
    } catch (err) {
      console.error('Error adding employee:', err);
      alert(err.response?.data?.message || 'Failed to add employee');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow">
      <h2 className="text-2xl font-semibold text-gray-800 mb-2">Add Employee</h2>
      <p className="text-sm text-gray-500 mb-6">
        New employees are created with default password <strong>Rubamin@123</strong>.
      </p>

      {message && <div className="mb-4 bg-green-50 text-green-600 p-3 rounded text-sm">{message}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee Code</label>
            <input
              type="text"
              required
              value={formData.EmployeeCode}
              onChange={(e) => handleChange('EmployeeCode', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="e.g. EMP005"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username (Auto-generated)</label>
            <input
              type="text"
              required
              readOnly
              value={formData.Username}
              onChange={() => {}} // Satisfies React controlled input requirement for readOnly fields
              className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
              placeholder="firstname.lastname"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              required
              value={formData.FirstName}
              onChange={(e) => handleChange('FirstName', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              required
              value={formData.LastName}
              onChange={(e) => handleChange('LastName', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address (Editable)</label>
            <input
              type="email"
              required
              value={formData.Email}
              onChange={(e) => handleChange('Email', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="firstname.lastname@rubamin.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile No.</label>
            <input
              type="text"
              required
              value={formData.MobileNo}
              onChange={(e) => handleChange('MobileNo', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
            <input
              type="text"
              value={formData.Designation}
              onChange={(e) => handleChange('Designation', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
            <input
              type="text"
              value={formData.Grade}
              onChange={(e) => handleChange('Grade', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Post</label>
            <input
              type="text"
              value={formData.Post}
              onChange={(e) => handleChange('Post', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              value={formData.DepartmentID}
              onChange={(e) => handleChange('DepartmentID', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              disabled={loadingDropdowns}
            >
              <option value="">-- Select Department --</option>
              {departments.map((dept) => (
                <option key={dept.DepartmentID} value={dept.DepartmentID}>
                  {dept.DepartmentName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <hr className="my-2" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reporting Manager</label>
            <select
              value={formData.ReportingManagerID}
              onChange={(e) => handleChange('ReportingManagerID', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              disabled={loadingDropdowns}
            >
              <option value="">-- None --</option>
              {managers.map((emp) => (
                <option key={emp.UserID} value={emp.UserID}>
                  {emp.FirstName} {emp.LastName} ({emp.Role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HOD</label>
            <select
              value={formData.HODID}
              onChange={(e) => handleChange('HODID', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              disabled={loadingDropdowns}
            >
              <option value="">-- None --</option>
              {hods.map((emp) => (
                <option key={emp.UserID} value={emp.UserID}>
                  {emp.FirstName} {emp.LastName} ({emp.Role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Head</label>
            <select
              value={formData.BusinessHeadID}
              onChange={(e) => handleChange('BusinessHeadID', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              disabled={loadingDropdowns}
            >
              <option value="">-- None --</option>
              {businessHeads.map((emp) => (
                <option key={emp.UserID} value={emp.UserID}>
                  {emp.FirstName} {emp.LastName} ({emp.Role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            value={formData.Role}
            onChange={(e) => handleChange('Role', e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="Employee">Employee</option>
            <option value="Manager">Manager</option>
            <option value="HOD">HOD</option>
            <option value="CFO">CFO</option>
            <option value="BusinessHead">Business Head</option>
            <option value="Admin">Admin</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-2 rounded-md disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Employee'}
        </button>
      </form>
    </div>
  );
};

export default AddEmployees;