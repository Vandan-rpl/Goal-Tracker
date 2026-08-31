import React, { useState } from 'react';
import api from '../../services/api';

const EmployeeExcelUpload = () => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Secure template download using Axios blob to pass authentication headers
  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      const response = await api.get('/admin/download-template', {
        responseType: 'blob', // Important for handling binary files
      });

      // Create a blob link to trigger download
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', 'Employee_Upload_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('Template Download Error:', err);
      alert('Failed to download template.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Handle excel file submission
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    const data = new FormData();
    data.append('file', file);

    try {
      setUploading(true);
      setMessage('');
      setErrorDetails([]);

      const res = await api.post('/admin/upload-employees', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setMessage(res.data.message || 'Employees imported successfully via Excel!');
        if (res.data.data?.errors && res.data.data.errors.length > 0) {
          setErrorDetails(res.data.data.errors);
        }
      }
    } catch (err) {
      console.error('Excel Upload Error:', err);
      alert(err.response?.data?.message || 'Failed to upload excel file.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-lg shadow">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Upload Employees Excel</h2>

      {message && (
        <div className="mb-4 bg-green-50 text-green-600 p-3 rounded text-sm font-medium">
          {message}
        </div>
      )}

      {errorDetails.length > 0 && (
        <div className="mb-4 bg-red-50 text-red-600 p-3 rounded text-sm">
          <p className="font-semibold mb-1">Some rows encountered errors during import:</p>
          <ul className="list-disc pl-5 space-y-1">
            {errorDetails.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Template download button with Axios authentication */}
      <div className="mb-6 bg-blue-50 border border-blue-100 p-4 rounded-md flex justify-between items-center">
        <div>
          <span className="text-sm text-blue-900 font-medium block">Need the standard upload format?</span>
          <span className="text-xs text-blue-600">Download formatted Excel template.</span>
        </div>
        <button 
          onClick={handleDownloadTemplate}
          disabled={downloadingTemplate}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 whitespace-nowrap disabled:opacity-50"
        >
          {downloadingTemplate ? 'Downloading...' : 'Download Template'}
        </button>
      </div>

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Excel File (.xlsx)</label>
          <input 
            type="file" 
            accept=".xlsx, .xls"
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full border p-2 rounded-md text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            required
          />
        </div>

        <button 
          type="submit" 
          disabled={uploading}
          className="w-full bg-green-600 text-white py-2 rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {uploading ? 'Processing & Importing...' : 'Upload & Import'}
        </button>
      </form>
    </div>
  );
};

export default EmployeeExcelUpload;