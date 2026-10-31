import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuth from '../../hooks/useAuth';
import PasswordChecklist from '../../components/PasswordChecklist/PasswordChecklist';
import PasswordErrorList from '../../components/PasswordChecklist/PasswordErrorList';
import { passwordErrorsFrom } from '../../utils/passwordPolicy';

const ForceResetPassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [errorList, setErrorList] = useState([]);
  const navigate = useNavigate();
  const { user, markPasswordChanged } = useAuth();

  // Public route: without a session there is nothing to change.
  if (!user || !localStorage.getItem('token')) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setErrorList([]);

    // The backend checks every password rule and returns all failures.
    try {
      const token = localStorage.getItem('token');
      const response = await api.post(
        '/auth/reset-password',
        { currentPassword, newPassword, confirmPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage(response.data.message || 'Password reset successfully!');
      // Updates context + localStorage so ProtectedRoute lets the user through
      setTimeout(() => {
        markPasswordChanged();
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating password.');
      setErrorList(passwordErrorsFrom(err.response?.data));
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
        {error && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded text-sm" role="alert">
            {/* A single rule is already the message; list them when there are several. */}
            {errorList.length > 1 ? (
              <>
                <p className="mb-1">{error}</p>
                <PasswordErrorList errors={errorList} />
              </>
            ) : (
              error
            )}
          </div>
        )}
        
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
              autoComplete="new-password"
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input 
              type="password" 
              required
              autoComplete="new-password"
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <PasswordChecklist password={newPassword} confirmPassword={confirmPassword} />
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