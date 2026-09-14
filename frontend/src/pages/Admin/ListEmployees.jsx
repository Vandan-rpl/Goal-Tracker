import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const ListEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [saving, setSaving] = useState(false);

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

  const openEditor = async (employee) => {
    setEditingEmployee(employee);
    setFormData({
      ...employee,
      EmployeeCode: employee.EmployeeCode || '', Username: employee.Username || '', Email: employee.Email || '',
      FirstName: employee.FirstName || '', LastName: employee.LastName || '', MobileNo: employee.MobileNo || '',
      DepartmentID: employee.DepartmentID || '', Designation: employee.Designation || '', Grade: employee.Grade || '', Post: employee.Post || '',
      ReportingManagerID: employee.ReportingManagerID || '', HODID: employee.HODID || '', BusinessHeadID: employee.BusinessHeadID || '',
    });
    try {
      const res = await api.get('/admin/dropdown-data');
      if (res.data.success) {
        setDepartments(res.data.data.departments || []);
        setAllEmployees((res.data.data.employees || []).filter((item) => item.UserID !== employee.UserID));
      }
    } catch (err) {
      console.error('Error loading edit options:', err);
    }
  };

  const closeEditor = () => { setEditingEmployee(null); setFormData(null); };

  const saveEmployee = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await api.put(`/admin/employees/${editingEmployee.UserID}`, {
        ...formData,
        DepartmentID: formData.DepartmentID || null,
        ReportingManagerID: formData.ReportingManagerID || null,
        HODID: formData.HODID || null,
        BusinessHeadID: formData.BusinessHeadID || null,
      });
      if (!res.data.success) throw new Error(res.data.message);
      setMessage(res.data.message || 'Employee updated successfully.');
      closeEditor();
      fetchEmployees();
    } catch (err) {
      alert(err.response?.data?.errors?.join('\n') || err.response?.data?.message || err.message || 'Failed to update employee.');
    } finally { setSaving(false); }
  };

  const deleteEmployee = async () => {
    if (!window.confirm(`Delete ${editingEmployee.FirstName} ${editingEmployee.LastName}? Their account will be deactivated and historical records retained.`)) return;
    setSaving(true);
    try {
      const res = await api.delete(`/admin/employees/${editingEmployee.UserID}`);
      if (!res.data.success) throw new Error(res.data.message);
      setMessage(res.data.message || 'Employee deleted successfully.');
      closeEditor();
      fetchEmployees();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete employee.');
    } finally { setSaving(false); }
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
    <div className="max-w-7xl mx-auto my-6 bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
      
      {/* Header Section */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Employee Directory</h2>
            <p className="text-slate-300 text-sm mt-1">Manage system access, hierarchy, and active user profiles.</p>
          </div>

          {/* Search Input Bar */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search name, email, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white/20 transition-all duration-200"
            />
            <svg
              className="w-4 h-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Success Alert Banner */}
        {message && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-800 flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium">{message}</p>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
            <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm font-medium">Fetching employee profiles...</span>
          </div>
        ) : (
          /* Table Section */
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Username</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100 bg-white">
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.UserID} className="hover:bg-slate-50/70 transition-colors duration-150 group">
                      
                      {/* Name & Email Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                            {emp.FirstName?.[0]}{emp.LastName?.[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {emp.FirstName} {emp.LastName}
                            </div>
                            <div className="text-xs text-slate-400">{emp.Email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Employee Code */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {emp.EmployeeCode || 'N/A'}
                        </span>
                      </td>

                      {/* Username */}
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                        {emp.Username}
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {emp.DepartmentName || <span className="text-slate-400 italic">Unassigned</span>}
                      </td>

                      {/* Role Pill */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          {emp.Role}
                        </span>
                      </td>

                      {/* Active / Inactive Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                          emp.IsActive 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' 
                            : 'bg-rose-50 text-rose-700 border-rose-200/80'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${emp.IsActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {emp.IsActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openEditor(emp)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="text-sm font-medium">No employees matching your filter.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL EDITOR */}
      {editingEmployee && formData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={saveEmployee}
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-100"
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Edit Employee Profile</h3>
                <p className="text-xs text-slate-300">Modify credentials, department settings, or system roles.</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Fields Grid */}
            <div className="p-6 space-y-6">
              
              {/* Section 1: Basic Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1.5">
                  Personal Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    ['EmployeeCode', 'Employee Code'],
                    ['Username', 'Username'],
                    ['FirstName', 'First Name'],
                    ['LastName', 'Last Name'],
                    ['Email', 'Email Address', 'email'],
                    ['MobileNo', 'Mobile Number'],
                    ['Designation', 'Designation'],
                    ['Grade', 'Grade'],
                    ['Post', 'Post'],
                  ].map(([field, label, type = 'text']) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
                      <input
                        required={['Username', 'FirstName', 'Email'].includes(field)}
                        type={type}
                        value={formData[field] || ''}
                        onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Department & Role */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1.5">
                  Department & Role
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                    <select
                      value={formData.DepartmentID || ''}
                      onChange={(e) => setFormData({ ...formData, DepartmentID: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    >
                      <option value="">-- None --</option>
                      {departments.map((dept) => (
                        <option key={dept.DepartmentID} value={dept.DepartmentID}>
                          {dept.DepartmentName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">System Role</label>
                    <select
                      value={formData.Role || 'Employee'}
                      onChange={(e) => setFormData({ ...formData, Role: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    >
                      {['Employee', 'Manager', 'HOD', 'BusinessHead'].map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Management Approvers */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1.5">
                  Management Hierarchy
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    ['ReportingManagerID', 'Reporting Manager'],
                    ['HODID', 'HOD'],
                    ['BusinessHeadID', 'Business Head'],
                  ].map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
                      <select
                        value={formData[field] || ''}
                        onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="">-- None --</option>
                        {allEmployees.map((emp) => (
                          <option key={emp.UserID} value={emp.UserID}>
                            {emp.FirstName} {emp.LastName} ({emp.Role})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 4: Account Status Toggle */}
              <div className="pt-2">
                <label className="inline-flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 cursor-pointer w-full">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.IsActive)}
                    onChange={(e) => setFormData({ ...formData, IsActive: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-900 block">Active Account Status</span>
                    <span className="text-xs text-slate-500 block">Uncheck to revoke login access for this employee.</span>
                  </div>
                </label>
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between items-center rounded-b-2xl">
              <button
                type="button"
                onClick={deleteEmployee}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Delete Account
              </button>

              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-md shadow-indigo-200 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}

export default ListEmployees;
