import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { toast } from 'react-toastify';
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState(''); // Handles either username or email input
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Sends the username/email field to match backend requirement
    try {
      const res = await login(username, password);

      if (res.success) {
        // Check if password change is required on first login
        const passwordChangedState = res.isPasswordChanged ?? res.data?.isPasswordChanged;

        if (passwordChangedState === false) {
          navigate('/force-reset-password');
        } else {
          toast.success('Login successful!');
          navigate('/dashboard');
        }
      } else {
        const errorMsg = res.message || 'Login failed. Please check your credentials.';
        toast.error(errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      console.error('Login error: ', err);
      const fallbackMsg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      toast.error('Login failed. Please check your credentials.');
      setError(fallbackMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-50 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] p-4">
      
      {/* Background Decorative Soft Gradient Blobs */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-100 rounded-full blur-3xl pointer-events-none opacity-60" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-100 rounded-full blur-3xl pointer-events-none opacity-60" />

      {/* Main Card Container */}
      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 p-8 relative z-10">
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 mb-3 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In</h2>
          <p className="text-sm text-slate-500 mt-1">Please enter your details to access your account</p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mb-6 flex items-start space-x-3 bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username/Email Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Username or Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-5 h-5" />
              </div>
              <input 
                type="text" 
                required
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition duration-200 text-sm"
                placeholder="Enter username or email"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <Link 
                to="/forgot-password" 
                className="text-xs text-blue-600 hover:text-blue-700 transition duration-150 font-semibold"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <input 
                type={showPassword ? 'text' : 'password'} 
                required
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-11 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition duration-200 text-sm"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium py-2.5 rounded-xl transition duration-200 shadow-md shadow-blue-500/20 flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Logging in...</span>
              </>
            ) : (
              <span>Login</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;