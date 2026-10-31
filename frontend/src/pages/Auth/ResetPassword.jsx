import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';
import api from '../../services/api';

/**
 * Old emailed reset links (/reset-password?token=...) no longer work:
 * Forgot Password now uses an emailed OTP. This page only says so and
 * lets the backend log that an old link was opened. The token is never
 * sent anywhere and is removed from the address bar.
 */
const LEGACY_LINK_MESSAGE = 'This link is no longer valid. Please use Forgot Password again.';

const ResetPassword = () => {
  const reported = useRef(false);

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }

    // StrictMode runs effects twice in development; report once.
    if (reported.current) return;
    reported.current = true;
    api.post('/auth/forgot-password/legacy-link-opened').catch(() => {});
  }, []);

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-50 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] p-4">
      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 p-8 relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 mb-3 shadow-sm">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-5">Reset Password</h2>

        <div role="alert" className="mb-6 flex items-start space-x-3 bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-sm text-left">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
          <span className="leading-snug">{LEGACY_LINK_MESSAGE}</span>
        </div>

        <Link
          to="/forgot-password"
          className="w-full inline-flex justify-center bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium py-2.5 rounded-xl transition duration-200 shadow-md shadow-blue-500/20"
        >
          Go to Forgot Password
        </Link>

        <div className="mt-4">
          <Link to="/login" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-semibold">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
