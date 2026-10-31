import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, Mail,
} from 'lucide-react';
import api from '../../services/api';
import PasswordChecklist from '../../components/PasswordChecklist/PasswordChecklist';
import PasswordErrorList from '../../components/PasswordChecklist/PasswordErrorList';
import { passwordErrorsFrom } from '../../utils/passwordPolicy';

/**
 * Forgot Password: one guided screen in three steps.
 *   1. email     -> POST /auth/forgot-password/request-otp (always the same answer)
 *   2. otp       -> POST /auth/forgot-password/verify-otp  (returns a reset token)
 *   3. password  -> POST /auth/forgot-password/reset-password
 *
 * The reset token lives only in this component's state (never in the URL or
 * browser storage), so step 3 cannot be reached without finishing step 2.
 * The backend enforces every rule; this screen only guides the user.
 */

const STEP = Object.freeze({ EMAIL: 'email', OTP: 'otp', PASSWORD: 'password' });

const STEPS = [
  { key: STEP.EMAIL, label: 'Email' },
  { key: STEP.OTP, label: 'Verify OTP' },
  { key: STEP.PASSWORD, label: 'New password' },
];

// Used until the first request-otp answer arrives with the server's values.
const DEFAULT_OTP_SETTINGS = { otpLength: 6, otpValidMinutes: 10, resendAfterSeconds: 60 };

// OTP problems where the only way forward is a new OTP.
const NEEDS_NEW_OTP = ['OTP_EXPIRED', 'OTP_LOCKED', 'OTP_NOT_VALID'];

// Reset token problems where the user has to start over.
const NEEDS_RESTART = ['RESET_SESSION_INVALID', 'RESET_SESSION_EXPIRED'];

const RESET_SUCCESS_FALLBACK = 'Your password has been reset. Please log in with your new password.';

const inputClass =
  'w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition duration-200 text-sm disabled:opacity-60';

const primaryButtonClass =
  'w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium py-2.5 rounded-xl transition duration-200 shadow-md shadow-blue-500/20 flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed';

const labelClass = 'block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2';

const secondsLeft = (deadline, now) => Math.max(0, Math.ceil((deadline - now) / 1000));

const formatMmSs = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

// Password rule failures come after the code: errors = ['VALIDATION', ...rules].
const PASSWORD_RULES_CODE = 'VALIDATION';

const readError = (err) => ({
  code: err.response?.data?.errors?.[0] || null,
  errors: passwordErrorsFrom(err.response?.data, PASSWORD_RULES_CODE),
  message: err.response
    ? err.response.data?.message || 'Something went wrong. Please try again.'
    : 'Could not reach the server. Please check your connection and try again.',
});

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(STEP.EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [otpSettings, setOtpSettings] = useState(DEFAULT_OTP_SETTINGS);
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [resetToken, setResetToken] = useState('');
  const [resetTokenExpiresAt, setResetTokenExpiresAt] = useState(0);

  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState(null);
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const [now, setNow] = useState(() => Date.now());

  // Tick once a second while there is a countdown on screen.
  useEffect(() => {
    if (step === STEP.EMAIL) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);

  const otpSecondsLeft = secondsLeft(otpExpiresAt, now);
  const resendSecondsLeft = secondsLeft(resendAvailableAt, now);
  const resetSecondsLeft = secondsLeft(resetTokenExpiresAt, now);
  const otpTimedOut = step === STEP.OTP && otpSecondsLeft === 0;
  const resetTimedOut = step === STEP.PASSWORD && resetSecondsLeft === 0;
  const otpBlocked = otpTimedOut || NEEDS_NEW_OTP.includes(errorCode);

  // One request at a time: guards against double clicks and Enter + click.
  const runOnce = async (work) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const showError = ({ code, message, errors = [] }) => {
    setErrorCode(code);
    setError(message);
    setPasswordErrors(code === PASSWORD_RULES_CODE ? errors : []);
    setInfo('');
  };

  const clearMessages = () => {
    setError('');
    setErrorCode(null);
    setPasswordErrors([]);
    setInfo('');
  };

  const requestOtp = () => runOnce(async () => {
    clearMessages();
    try {
      const response = await api.post('/auth/forgot-password/request-otp', { email: email.trim() });
      const settings = { ...DEFAULT_OTP_SETTINGS, ...(response.data?.data || {}) };
      const sentAt = Date.now();

      setOtpSettings(settings);
      setOtpExpiresAt(sentAt + settings.otpValidMinutes * 60 * 1000);
      setResendAvailableAt(sentAt + settings.resendAfterSeconds * 1000);
      setNow(sentAt);
      setOtp('');
      setInfo(response.data?.message || 'If this email is registered, an OTP has been sent to it.');
      setStep(STEP.OTP);
    } catch (err) {
      showError(readError(err));
    }
  });

  const verifyOtp = () => runOnce(async () => {
    clearMessages();
    try {
      const response = await api.post('/auth/forgot-password/verify-otp', { email: email.trim(), otp });
      const data = response.data?.data || {};
      const verifiedAt = Date.now();

      setResetToken(data.resetToken);
      setResetTokenExpiresAt(verifiedAt + (data.expiresInSeconds || 600) * 1000);
      setNow(verifiedAt);
      setOtp('');
      setInfo(response.data?.message || 'OTP verified. You can now set a new password.');
      setStep(STEP.PASSWORD);
    } catch (err) {
      showError(readError(err));
      setOtp('');
    }
  });

  const resetPassword = () => runOnce(async () => {
    clearMessages();
    try {
      const response = await api.post('/auth/forgot-password/reset-password', {
        resetToken,
        newPassword,
        confirmPassword,
      });

      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');

      const successMessage = response.data?.message || RESET_SUCCESS_FALLBACK;
      toast.success(successMessage);
      navigate('/login', { replace: true, state: { successMessage } });
    } catch (err) {
      showError(readError(err));
    }
  });

  const startOver = () => {
    setResetToken('');
    setResetTokenExpiresAt(0);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    clearMessages();
    setStep(STEP.EMAIL);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (step === STEP.EMAIL) requestOtp();
    if (step === STEP.OTP) verifyOtp();
    if (step === STEP.PASSWORD) resetPassword();
  };

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-slate-50 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] p-4">

      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-100 rounded-full blur-3xl pointer-events-none opacity-60" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-100 rounded-full blur-3xl pointer-events-none opacity-60" />

      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 p-8 relative z-10">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 mb-3 shadow-sm">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Forgot Password</h2>
          <p className="text-sm text-slate-500 mt-1">
            {step === STEP.EMAIL && 'Enter your registered email to receive a one-time password (OTP).'}
            {step === STEP.OTP && 'Enter the OTP sent to your email.'}
            {step === STEP.PASSWORD && 'Choose a new password for your account.'}
          </p>
        </div>

        {/* Step indicator */}
        <ol className="flex items-center justify-between mb-6">
          {STEPS.map((s, index) => {
            const done = index < currentStepIndex;
            const active = index === currentStepIndex;
            return (
              <li key={s.key} className="flex-1 flex flex-col items-center text-center">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border ${
                    done
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : active
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-400'
                  }`}
                >
                  {done ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                </span>
                <span className={`mt-1 text-xs ${active ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Messages */}
        {info && !error && (
          <div className="mb-5 flex items-start space-x-3 bg-green-50 border border-green-200 text-green-700 p-3.5 rounded-xl text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-green-500" />
            <span className="leading-snug">{info}</span>
          </div>
        )}
        {error && (
          <div role="alert" className="mb-5 flex items-start space-x-3 bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <div className="leading-snug">
              {/* A single rule is already the message; list them when there are several. */}
              <span>{error}</span>
              {passwordErrors.length > 1 && <PasswordErrorList errors={passwordErrors} className="mt-1" />}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>

          {/* Step 1: email */}
          {step === STEP.EMAIL && (
            <>
              <div>
                <label htmlFor="fp-email" className={labelClass}>Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    id="fp-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    required
                    value={email}
                    disabled={busy}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="Enter your registered email"
                  />
                </div>
              </div>
              <button type="submit" disabled={busy || !email.trim()} className={primaryButtonClass}>
                {busy ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Sending OTP...</span></> : <span>Send OTP</span>}
              </button>
            </>
          )}

          {/* Step 2: OTP */}
          {step === STEP.OTP && (
            <>
              <p className="text-sm text-slate-600">
                Email: <span className="font-semibold text-slate-900 break-all">{email.trim()}</span>{' '}
                <button type="button" onClick={startOver} disabled={busy} className="text-blue-600 hover:text-blue-700 font-semibold text-xs ml-1">
                  Change
                </button>
              </p>

              <div>
                <label htmlFor="fp-otp" className={labelClass}>{otpSettings.otpLength}-digit OTP</label>
                <input
                  id="fp-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={otpSettings.otpLength}
                  value={otp}
                  disabled={busy || otpBlocked}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, otpSettings.otpLength));
                    if (errorCode === 'OTP_INCORRECT' || errorCode === 'VALIDATION') {
                      setError('');
                      setErrorCode(null);
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-slate-300 rounded-xl text-slate-900 text-center text-2xl font-semibold tracking-[0.5em] placeholder-slate-300 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition duration-200 disabled:opacity-60"
                  placeholder={'0'.repeat(otpSettings.otpLength)}
                />
                <p className={`mt-2 text-xs ${otpTimedOut ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                  {otpTimedOut
                    ? 'This OTP has expired. Please request a new OTP.'
                    : `OTP valid for ${formatMmSs(otpSecondsLeft)}`}
                </p>
              </div>

              <button
                type="submit"
                disabled={busy || otpBlocked || otp.length !== otpSettings.otpLength}
                className={primaryButtonClass}
              >
                {busy ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Verifying...</span></> : <span>Verify OTP</span>}
              </button>

              <div className="text-center text-sm text-slate-600">
                Didn&apos;t get the OTP?{' '}
                <button
                  type="button"
                  onClick={requestOtp}
                  disabled={busy || resendSecondsLeft > 0}
                  className="text-blue-600 hover:text-blue-700 font-semibold disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  {resendSecondsLeft > 0 ? `Resend OTP in ${resendSecondsLeft}s` : 'Resend OTP'}
                </button>
              </div>
            </>
          )}

          {/* Step 3: new password */}
          {step === STEP.PASSWORD && (
            <>
              <div>
                <label htmlFor="fp-new-password" className={labelClass}>New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="fp-new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    autoFocus
                    value={newPassword}
                    disabled={busy || resetTimedOut}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`${inputClass} pr-11`}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="fp-confirm-password" className={labelClass}>Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="fp-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    disabled={busy || resetTimedOut}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Re-enter new password"
                  />
                </div>
                <PasswordChecklist password={newPassword} confirmPassword={confirmPassword} />
                <p className={`mt-2 text-xs ${resetTimedOut ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                  {resetTimedOut
                    ? 'This password reset session has expired. Please start again.'
                    : `Set your new password within ${formatMmSs(resetSecondsLeft)}`}
                </p>
              </div>

              {resetTimedOut || NEEDS_RESTART.includes(errorCode) ? (
                <button type="button" onClick={startOver} className={primaryButtonClass}>
                  <span>Start again</span>
                </button>
              ) : (
                <button type="submit" disabled={busy} className={primaryButtonClass}>
                  {busy ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Saving...</span></> : <span>Reset Password</span>}
                </button>
              )}
            </>
          )}

          <div className="text-center">
            <Link to="/login" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-semibold">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
