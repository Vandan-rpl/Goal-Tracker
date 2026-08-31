import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/forgot-password', { email });
      setMessage('Password reset instructions sent to your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Error sending request.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Forgot Password</h2>
        {message && <div className="mb-4 bg-green-50 text-green-600 p-3 rounded text-sm">{message}</div>}
        {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enter your email</label>
            <input 
              type="email" 
              required
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md">
            Send Reset Link
          </button>
          <div className="text-center mt-4">
            <Link to="/login" className="text-sm text-blue-600 hover:underline">Back to Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;