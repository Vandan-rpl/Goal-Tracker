import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import {toast} from 'react-toastify';

const Login = () => {
  const [username, setUsername] = useState(''); // Handles either username or email input
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Sends the username/email field to match backend requirement
    try {
      const res = await login(username, password); 

    if (res.success) {
      // Check if password change is required on first login
      // Adjust 'res.isPasswordChanged' or 'res.data?.isPasswordChanged' based on how your useAuth hook returns data
      const passwordChangedState = res.isPasswordChanged ?? res.data?.isPasswordChanged;

      if (passwordChangedState === false) {
        navigate('/force-reset-password');
      } else {
        toast.success('Login successful!');
        navigate('/dashboard');
      }
    }else {
      toast.error(res.message || 'Login failed. Please check your credentials.');
      setError(res.message || 'Login failed. Please check your credentials.');
    }
    } catch (err) {
      console.error('Login error: ',err);
      toast.error('Login failed. Please check your credentials.');
      setError(err.respones?.data?.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Sign In</h2>
        {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username or Email Address</label>
            <input 
              type="text" 
              required
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter username or email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-blue-600 hover:underline">Forgot password?</Link>
          </div>
          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md transition font-medium"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;