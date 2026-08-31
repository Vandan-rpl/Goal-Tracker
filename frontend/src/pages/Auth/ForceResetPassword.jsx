import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const ForceResetPassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await api.post(
        '/auth/reset-password',
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local storage user state so that the protected route allows dashboard access
      const userString = localStorage.getItem('user');
      if (userString) {
        const user = JSON.parse(userString);
        user.isPasswordChanged = true;
        localStorage.setItem('user', JSON.stringify(user));
      }

      setMessage(response.data.message || 'Password reset successfully!');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating password.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Change Password Required</h2>
        <p className="text-sm text-gray-600 text-center mb-6">
          You must change your default password before accessing your account.
        </p>
        
        {message && <div className="mb-4 bg-green-50 text-green-600 p-3 rounded text-sm">{message}</div>}
        {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password (Default)</label>
            <input 
              type="password" 
              required
              value={currentPassword} 
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
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
          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md transition font-medium"
          >
            Update Password & Continue
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForceResetPassword;