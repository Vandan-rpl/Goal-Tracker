import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const AddEmployees = () => {
  const roleRanks = {
    Employee: 1,
    Manager: 2,
    HOD: 3,
    BusinessHead: 4
  };

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

    if (field === 'Role') {
      updated.ReportingManagerID = '';
    }

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

  const managers = employees.filter(
    (emp) => roleRanks[emp.Role] > roleRanks[formData.Role]
  );
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
    <div className="max-w-4xl mx-auto my-8 bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
      {/* Form Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <h2 className="text-2xl font-bold tracking-tight text-white">Add New Employee</h2>
        <p className="text-slate-300 text-sm mt-1">Create profiles, assign hierarchy, and manage access roles.</p>

        {/* Default Password Banner */}
        <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs text-indigo-200">
          <svg className="w-3.5 h-3.5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <span>Default Initial Password:</span>
          <code className="font-mono bg-white/20 px-2 py-0.5 rounded text-white font-medium">Rubamin@123</code>
        </div>
      </div>

      <div className="p-8">
        {/* Success Alert Message */}
        {message && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-800 flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium">{message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* SECTION 1: Personal & Account Identity */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">
              Identity & Credentials
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Employee Code</label>
                <input
                  type="text"
                  required
                  value={formData.EmployeeCode}
                  onChange={(e) => handleChange('EmployeeCode', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  placeholder="e.g. EMP005"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Username (Auto-generated)</label>
                <input
                  type="text"
                  required
                  readOnly
                  value={formData.Username}
                  onChange={() => {}}
                  className="w-full px-3.5 py-2.5 bg-slate-100/70 border border-slate-200 rounded-lg text-sm text-slate-500 font-mono cursor-not-allowed"
                  placeholder="firstname.lastname"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">First Name</label>
                <input
                  type="text"
                  required
                  value={formData.FirstName}
                  onChange={(e) => handleChange('FirstName', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  placeholder="First Name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Last Name</label>
                <input
                  type="text"
                  required
                  value={formData.LastName}
                  onChange={(e) => handleChange('LastName', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  placeholder="Last Name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.Email}
                  onChange={(e) => handleChange('Email', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  placeholder="Your Email"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Mobile Number</label>
                <input
                  type="text"
                  required
                  value={formData.MobileNo}
                  onChange={(e) => handleChange('MobileNo', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  placeholder="+91 1234567890"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Organization & Work Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">
              Organizational Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Designation</label>
                <input
                  type="text"
                  value={formData.Designation}
                  onChange={(e) => handleChange('Designation', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  placeholder="Senior Developer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Grade</label>
                <input
                  type="text"
                  value={formData.Grade}
                  onChange={(e) => handleChange('Grade', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  placeholder="L2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Post</label>
                <input
                  type="text"
                  value={formData.Post}
                  onChange={(e) => handleChange('Post', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  placeholder="Software Engineer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Department</label>
                <select
                  value={formData.DepartmentID}
                  onChange={(e) => handleChange('DepartmentID', e.target.value)}
                  disabled={loadingDropdowns}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 disabled:opacity-50"
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
          </div>

          {/* SECTION 3: Hierarchy & Approvers */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">
              Management Hierarchy
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Reporting Manager</label>
                <select
                  value={formData.ReportingManagerID}
                  onChange={(e) => handleChange('ReportingManagerID', e.target.value)}
                  disabled={loadingDropdowns}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 disabled:opacity-50"
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
                <label className="block text-xs font-medium text-slate-700 mb-1.5">HOD</label>
                <select
                  value={formData.HODID}
                  onChange={(e) => handleChange('HODID', e.target.value)}
                  disabled={loadingDropdowns}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 disabled:opacity-50"
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
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Business Head</label>
                <select
                  value={formData.BusinessHeadID}
                  onChange={(e) => handleChange('BusinessHeadID', e.target.value)}
                  disabled={loadingDropdowns}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 disabled:opacity-50"
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
          </div>

          {/* SECTION 4: Role Assignment */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">
              System Access
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">System Role</label>
              <select
                value={formData.Role}
                onChange={(e) => handleChange('Role', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
              >
                <option value="Employee">Employee</option>
                <option value="Manager">Manager</option>
                <option value="HOD">HOD</option>
                <option value="BusinessHead">Business Head</option>
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Creating Employee...</span>
                </>
              ) : (
                <span>Create Employee</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEmployees;
