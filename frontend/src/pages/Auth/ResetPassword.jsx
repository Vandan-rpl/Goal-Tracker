import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token'); // URL માંથી token મેળવે છે
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!token) {
      setError('Invalid or missing reset token in URL.');
      return;
    }

    try {
      // અહી '/auth/reset-password' ના બદલે નવા બનાવેલા Route નો ઉપયોગ કરો
      const response = await api.post('/auth/reset-password-token', {
        token,
        newPassword
      });

      setMessage(response.data.message || 'Password reset successfully!');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Reset Password</h2>
        {message && <div className="mb-4 bg-green-50 text-green-600 p-3 rounded text-sm">{message}</div>}
        {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input 
              type="password" 
              required
              minLength={6}
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md">
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;