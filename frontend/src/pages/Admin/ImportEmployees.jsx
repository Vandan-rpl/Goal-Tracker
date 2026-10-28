import React, { useState } from 'react';
import api from '../../services/api';

const SOURCE_STYLES = {
  file: 'text-slate-700',
  database: 'text-slate-700',
  businessHead: 'text-amber-700 font-medium',
  businessHeadMatched: 'text-slate-700',
  notLinked: 'text-rose-700 font-medium',
  unchanged: 'text-slate-400',
};

const SOURCE_LABELS = {
  file: 'Matched in file',
  database: 'Matched existing user',
  businessHead: 'Blank — reports to Business Head',
  businessHeadMatched: 'Business Head',
  notLinked: 'Not linked',
  unchanged: 'Business Head (unchanged)',
};

const isHighlighted = (h) => ['businessHead', 'notLinked'].includes(h.reportingManager?.source);

const HierarchyCell = ({ value }) => (
  <td className="px-3 py-2 align-top">
    <div className="text-slate-900">{value.name || '—'}</div>
    <div className={`text-[11px] ${SOURCE_STYLES[value.source]}`}>{SOURCE_LABELS[value.source]}</div>
  </td>
);

const SectionTitle = ({ children }) => (
  <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">
    {children}
  </h3>
);

const TableShell = ({ headers, children }) => (
  <div className="overflow-x-auto border border-slate-200 rounded-lg">
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50 text-left text-xs font-medium text-slate-600">
        <tr>
          {headers.map((h) => (
            <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  </div>
);

const ImportEmployees = () => {
  const [file, setFile] = useState(null);
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const resetReports = () => {
    setPreview(null);
    setResult(null);
    setValidationErrors([]);
    setErrorMessage('');
  };

  const upload = async (dryRun) => {
    const data = new FormData();
    data.append('file', file);
    const params = new URLSearchParams();
    if (dryRun) params.set('dryRun', 'true');
    if (deactivateMissing) params.set('deactivateMissing', 'true');
    const query = params.toString();

    return api.post(`/admin/employees/import${query ? `?${query}` : ''}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  };

  const handleRequest = async (dryRun) => {
    if (!file) {
      setErrorMessage('Please choose an .xlsx file first.');
      return;
    }
    setLoading(true);
    setValidationErrors([]);
    setErrorMessage('');
    try {
      const res = await upload(dryRun);
      if (dryRun) {
        setPreview(res.data);
        setResult(null);
      } else {
        setResult(res.data);
        setPreview(null);
      }
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 400 && Array.isArray(data?.errors)) {
        setValidationErrors(data.errors);
      }
      setErrorMessage(data?.message || 'Failed to process the employee file.');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const report = result || preview;

  return (
    <div className="max-w-6xl mx-auto my-8 bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <h2 className="text-2xl font-bold tracking-tight text-white">Upload Employees (Excel)</h2>
        <p className="text-slate-300 text-sm mt-1">
          Upload HR's full employee export as-is. Only rows with Employee Status "Active" are uploaded. Preview the changes first, then confirm the import.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs text-indigo-200">
          <span>New employees get the default password:</span>
          <code className="font-mono bg-white/20 px-2 py-0.5 rounded text-white font-medium">Rubamin@123</code>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/60 text-rose-800 text-sm font-medium">
            {errorMessage}
          </div>
        )}
        {result && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-sm font-medium">
            {result.message}
          </div>
        )}

        {/* Upload */}
        <div className="space-y-4">
          <SectionTitle>Employee File</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Excel File (.xlsx, max 20 MB)</label>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  setFile(e.target.files[0] || null);
                  resetReports();
                }}
                className="w-full px-3.5 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-900 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={deactivateMissing}
                onChange={(e) => {
                  setDeactivateMissing(e.target.checked);
                  setPreview(null);
                }}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Deactivate employees who are not in this file (Admins are never deactivated)
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => handleRequest(true)}
              disabled={loading || !file}
              className="flex-1 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-medium py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading && !preview ? 'Processing...' : 'Preview Import'}
            </button>
            <button
              type="button"
              onClick={() => handleRequest(false)}
              disabled={loading || !preview}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading && preview ? 'Importing...' : 'Confirm Import'}
            </button>
          </div>
        </div>

        {/* Validation errors (HTTP 400) */}
        {validationErrors.length > 0 && (
          <div className="space-y-4">
            <SectionTitle>Validation Errors — nothing was saved</SectionTitle>
            <TableShell headers={['Row', 'Employee Code', 'Errors']}>
              {validationErrors.map((e, idx) => (
                <tr key={`${e.row}-${idx}`} className="bg-rose-50/40">
                  <td className="px-3 py-2 align-top">{e.row ?? '—'}</td>
                  <td className="px-3 py-2 align-top font-mono">{e.employeeCode || '—'}</td>
                  <td className="px-3 py-2">
                    <ul className="list-disc pl-4 space-y-0.5 text-rose-800">
                      {e.errors.map((msg) => (
                        <li key={msg}>{msg}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </TableShell>
          </div>
        )}

        {report && (
          <>
            {/* Counts */}
            <div className="space-y-4">
              <SectionTitle>{report.dryRun ? 'Preview (not saved yet)' : 'Upload Summary'}</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                {[
                  ['Users created', report.inserted],
                  ['Users updated', report.updated],
                  ['Not uploaded', report.notUploaded.length],
                  ['Manager not linked', report.managerNotLinked.length],
                  ['Skipped (not active)', report.skippedInactive.length],
                  ['Deactivated', report.deactivated],
                ].map(([label, value]) => (
                  <div key={label} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="text-2xl font-bold text-slate-900">{value}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Business Head for all uploaded employees: {report.businessHead.name} ({report.businessHead.employeeCode}).
                HOD is set to the same user as the Reporting Manager.
              </p>
            </div>

            {report.notUploaded.length > 0 && (
              <div className="space-y-4">
                <SectionTitle>Users not uploaded</SectionTitle>
                <TableShell headers={['Row', 'Employee Code', 'Name', 'Reason']}>
                  {report.notUploaded.map((u) => (
                    <tr key={u.row} className="bg-rose-50/40">
                      <td className="px-3 py-2 align-top">{u.row}</td>
                      <td className="px-3 py-2 align-top font-mono">{u.employeeCode || '—'}</td>
                      <td className="px-3 py-2 align-top text-slate-900">{u.name || '—'}</td>
                      <td className="px-3 py-2 text-rose-800">{u.reason}</td>
                    </tr>
                  ))}
                </TableShell>
              </div>
            )}

            {report.managerNotLinked.length > 0 && (
              <div className="space-y-4">
                <SectionTitle>Manager not linked</SectionTitle>
                <TableShell headers={['Row', 'Employee Code', 'Name', 'Reporting Manager (from file)', 'Parsed First Name', 'Parsed Last Name', 'Reason']}>
                  {report.managerNotLinked.map((u) => (
                    <tr key={u.row} className="bg-amber-50/40">
                      <td className="px-3 py-2 align-top">{u.row}</td>
                      <td className="px-3 py-2 align-top font-mono">{u.employeeCode}</td>
                      <td className="px-3 py-2 align-top text-slate-900">{u.name}</td>
                      <td className="px-3 py-2 align-top">{u.reportingManager}</td>
                      <td className="px-3 py-2 align-top">{u.parsedFirstName || '—'}</td>
                      <td className="px-3 py-2 align-top">{u.parsedLastName || '—'}</td>
                      <td className="px-3 py-2 text-amber-800">{u.reason}</td>
                    </tr>
                  ))}
                </TableShell>
              </div>
            )}

            {report.mobileNotSaved.length > 0 && (
              <div className="space-y-4">
                <SectionTitle>Mobile number not saved</SectionTitle>
                <p className="text-xs text-slate-500">
                  These users were uploaded without a mobile number because the value is longer than 20 characters.
                </p>
                <TableShell headers={['Row', 'Employee Code', 'Name', 'Value from file']}>
                  {report.mobileNotSaved.map((u) => (
                    <tr key={u.row} className="bg-amber-50/40">
                      <td className="px-3 py-2">{u.row}</td>
                      <td className="px-3 py-2 font-mono">{u.employeeCode}</td>
                      <td className="px-3 py-2 text-slate-900">{u.name}</td>
                      <td className="px-3 py-2 font-mono">{u.value}</td>
                    </tr>
                  ))}
                </TableShell>
              </div>
            )}

            {report.skippedInactive.length > 0 && (
              <div className="space-y-4">
                <SectionTitle>Skipped (not active)</SectionTitle>
                <TableShell headers={['Row', 'Employee Code', 'Name', 'Employee Status']}>
                  {report.skippedInactive.map((u) => (
                    <tr key={u.row}>
                      <td className="px-3 py-2">{u.row}</td>
                      <td className="px-3 py-2 font-mono">{u.employeeCode || '—'}</td>
                      <td className="px-3 py-2 text-slate-900">{u.name || '—'}</td>
                      <td className="px-3 py-2">{u.status || '(blank)'}</td>
                    </tr>
                  ))}
                </TableShell>
              </div>
            )}

            {report.newUsers.length > 0 && (
              <div className="space-y-4">
                <SectionTitle>New Users</SectionTitle>
                <TableShell headers={['Row', 'Employee Code', 'Name', 'Username']}>
                  {report.newUsers.map((u) => (
                    <tr key={u.employeeCode}>
                      <td className="px-3 py-2">{u.row}</td>
                      <td className="px-3 py-2 font-mono">{u.employeeCode}</td>
                      <td className="px-3 py-2 text-slate-900">{u.name}</td>
                      <td className="px-3 py-2 font-mono">{u.username}</td>
                    </tr>
                  ))}
                </TableShell>
              </div>
            )}

            <div className="space-y-4">
              <SectionTitle>Hierarchy</SectionTitle>
              <p className="text-xs text-slate-500">
                Highlighted rows report to the Business Head because Reporting Manager was blank, or their manager could not be linked.
              </p>
              <TableShell headers={['Row', 'Employee Code', 'Name', 'Reporting Manager / HOD', 'Role']}>
                {report.hierarchy.map((h) => (
                  <tr key={h.employeeCode} className={isHighlighted(h) ? 'bg-amber-50/60' : ''}>
                    <td className="px-3 py-2 align-top">{h.row}</td>
                    <td className="px-3 py-2 align-top font-mono">{h.employeeCode}</td>
                    <td className="px-3 py-2 align-top text-slate-900">{h.name}</td>
                    <HierarchyCell value={h.reportingManager} />
                    <td className="px-3 py-2 align-top">
                      {h.role}
                      {h.roleChanged && <span className="ml-1 text-[11px] text-indigo-600">(changed)</span>}
                    </td>
                  </tr>
                ))}
              </TableShell>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportEmployees;
