
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { authApi } from '../services/api';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 font-sans">
        <div className="w-full max-w-[460px] bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-white p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto">
            <Lock size={36} className="text-rose-400" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Invalid Link</h1>
          <p className="text-slate-500 text-sm font-medium">This password reset link is invalid or has expired.</p>
          <Link to="/forgot-password" className="inline-block w-full py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest text-center hover:bg-indigo-700 transition-colors">
            Request a New Link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirmation) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.resetPassword(token, password, passwordConfirmation);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
      } else {
        const firstError = res.errors
          ? Object.values(res.errors as Record<string, string[]>)[0]?.[0]
          : null;
        setError(firstError || res.message || 'Failed to reset password. The link may have expired.');
      }
    } catch {
      setError('Unable to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100/50 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-100/50 blur-[120px] rounded-full" />

      <div className="mb-8 flex items-center gap-4 relative z-10">
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center font-black text-white text-3xl shadow-2xl shadow-indigo-200">A</div>
        <div className="flex flex-col">
          <span className="font-black text-2xl text-slate-900 tracking-tight leading-none uppercase">Saas Books</span>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-1">Billing Software</span>
        </div>
      </div>

      <div className="w-full max-w-[460px] bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-white overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 relative z-10">
        <div className="p-10 md:p-12">
          {success ? (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={40} className="text-emerald-500" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Password Reset!</h1>
                <p className="text-slate-500 mt-3 text-sm font-medium leading-relaxed">
                  Your password has been updated successfully. Redirecting to login...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-10">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Reset Password</h1>
                <p className="text-slate-400 mt-3 text-sm font-bold uppercase tracking-widest text-[10px]">Enter your new password</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex items-center gap-3 animate-in shake duration-300">
                    <div className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">New Password</label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-14 pr-14 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 focus:bg-white transition-all font-bold text-sm"
                      placeholder="Min. 8 chars with uppercase & numbers"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 transition-all"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Confirm Password</label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      value={passwordConfirmation}
                      onChange={(e) => setPasswordConfirmation(e.target.value)}
                      className="w-full pl-14 pr-14 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 focus:bg-white transition-all font-bold text-sm"
                      placeholder="Re-enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 transition-all"
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all flex items-center justify-center transform active:scale-[0.98]"
                >
                  {isLoading ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {!success && (
          <div className="bg-slate-50/50 p-8 text-center border-t border-slate-100">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </div>
        )}
      </div>

      <div className="mt-8 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] relative z-10">
        © 2026 Saas Books Enterprise. Built for Excellence.
      </div>
    </div>
  );
};

export default ResetPassword;
