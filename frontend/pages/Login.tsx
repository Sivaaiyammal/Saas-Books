
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Zap } from 'lucide-react';
import { authApi, setTokens } from '../services/api';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await authApi.login({ email, password });

      if (response.success) {
        // Accessing tokens from the new structure: data.tokens
        const accessToken = response.data?.tokens?.accessToken;
        const refreshToken = response.data?.tokens?.refreshToken;
        if (accessToken && refreshToken) {
          setTokens(accessToken, refreshToken);
          onLogin();
        } else {
          setError('Authentication tokens missing from server response.');
        }
      } else {
        setError(response.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError('Unable to connect to server. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 font-sans relative overflow-hidden">
      {/* Decorative Background Elements */}
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
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome Back</h1>
            <p className="text-slate-400 mt-3 text-sm font-bold uppercase tracking-widest text-[10px]">Secure Admin Access Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex items-center gap-3 animate-in shake duration-300">
                <div className="w-2 h-2 bg-rose-500 rounded-full" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 focus:bg-white transition-all font-bold text-sm"
                  placeholder="admin@saasbooks.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Password</label>
              </div>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-14 pr-14 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 focus:bg-white transition-all font-bold text-sm"
                  placeholder="••••••••"
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

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" id="remember" className="peer sr-only" />
                  <div className="w-5 h-5 border-2 border-slate-200 rounded-lg peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all shadow-sm" />
                  <Zap size={10} className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">Remember me</span>
              </label>
              <a href="#" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors">Forgot Password?</a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all flex items-center justify-center transform active:scale-[0.98] group"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <span className="flex items-center gap-2">
                  Login <Zap size={14} className="group-hover:fill-current" />
                </span>
              )}
            </button>
          </form>
        </div>
        <div className="bg-slate-50/50 p-8 text-center border-t border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            First time here? <Link to="/register" className="text-indigo-600 font-black hover:text-indigo-700 ml-1">Create an Account</Link>
          </p>
        </div>
      </div>
      <div className="mt-8 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] relative z-10">
        © 2026 Saas Books Enterprise. Built for Excellence.
      </div>
    </div>
  );
};

export default Login;
